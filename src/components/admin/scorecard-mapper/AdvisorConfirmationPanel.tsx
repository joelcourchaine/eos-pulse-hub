import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Check, AlertCircle, Users, Wand2, Loader2 } from "lucide-react";
import { fuzzyNameMatch } from "@/utils/scorecardImportMatcher";
import { cn } from "@/lib/utils";

export interface AdvisorConfirmation {
  rowIndex: number;
  excelName: string;
  suggestedUserId: string | null;
  suggestedUserName: string | null;
  confidence: number;
  isConfirmed: boolean;
  isSkipped: boolean;
  isTotalsRow?: boolean; // Indicates this is a department totals row (e.g., "All Repair Orders")
}

interface StoreUser {
  id: string;
  full_name: string;
}

interface AdvisorConfirmationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisorNames: Array<{ name: string; rowIndex: number }>;
  storeUsers: StoreUser[];
  existingAliases: Array<{ alias_name: string; user_id: string; profileName: string | null }>;
  onApply: (confirmations: AdvisorConfirmation[]) => Promise<void>;
  templateCount: number;
}

// Pattern to detect "totals" rows that should be skipped
const TOTALS_PATTERNS = [
  /^all\s+repair\s+orders?$/i,
  /^total$/i,
  /^grand\s+total$/i,
  /^department\s+total$/i,
];

const isTotalsRow = (name: string): boolean => {
  return TOTALS_PATTERNS.some(pattern => pattern.test(name.trim()));
};

export const AdvisorConfirmationPanel: React.FC<AdvisorConfirmationPanelProps> = ({
  open,
  onOpenChange,
  advisorNames,
  storeUsers,
  existingAliases,
  onApply,
  templateCount,
}) => {
  const [confirmations, setConfirmations] = useState<AdvisorConfirmation[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // Auto-match advisors to users on mount or when data changes
  useEffect(() => {
    if (!open || advisorNames.length === 0) return;

    const matched = advisorNames.map(({ name, rowIndex }) => {
      // Check if it's a totals row - allow mapping but mark for manual selection
      const isTotals = isTotalsRow(name);
      
      // Check existing aliases first (works for totals rows too!)
      const aliasMatch = existingAliases.find(
        a => a.alias_name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (aliasMatch) {
        return {
          rowIndex,
          excelName: name,
          suggestedUserId: aliasMatch.user_id,
          suggestedUserName: aliasMatch.profileName || "Linked User",
          confidence: 1,
          isConfirmed: true, // Auto-confirm alias matches
          isSkipped: false,
          isTotalsRow: isTotals,
        };
      }
      
      // If it's a totals row with no existing alias, show for manual mapping
      if (isTotals) {
        return {
          rowIndex,
          excelName: name,
          suggestedUserId: null,
          suggestedUserName: null,
          confidence: 0,
          isConfirmed: false,
          isSkipped: false, // Allow mapping!
          isTotalsRow: true,
        };
      }

      // Fuzzy match against store users (for non-totals rows)

      // Fuzzy match against store users
      const matches = storeUsers
        .map(u => ({
          ...u,
          score: fuzzyNameMatch(name, u.full_name),
        }))
        .filter(m => m.score > 0.5)
        .sort((a, b) => b.score - a.score);

      const bestMatch = matches[0];

      return {
        rowIndex,
        excelName: name,
        suggestedUserId: bestMatch?.score >= 0.7 ? bestMatch.id : null,
        suggestedUserName: bestMatch?.full_name || null,
        confidence: bestMatch?.score || 0,
        isConfirmed: bestMatch?.score >= 0.85, // Auto-confirm high confidence
        isSkipped: false,
      };
    });

    setConfirmations(matched);
  }, [open, advisorNames, storeUsers, existingAliases]);

  // Stats
  const stats = useMemo(() => {
    const total = confirmations.filter(c => !c.isSkipped).length;
    const confirmed = confirmations.filter(c => c.isConfirmed && c.suggestedUserId).length;
    const needsReview = confirmations.filter(
      c => !c.isSkipped && !c.isConfirmed && c.suggestedUserId
    ).length;
    const unmatched = confirmations.filter(
      c => !c.isSkipped && !c.suggestedUserId
    ).length;
    const skipped = confirmations.filter(c => c.isSkipped).length;

    return { total, confirmed, needsReview, unmatched, skipped };
  }, [confirmations]);

  const handleToggleConfirm = (rowIndex: number) => {
    setConfirmations(prev =>
      prev.map(c =>
        c.rowIndex === rowIndex
          ? { ...c, isConfirmed: !c.isConfirmed }
          : c
      )
    );
  };

  const handleChangeUser = (rowIndex: number, userId: string) => {
    const user = storeUsers.find(u => u.id === userId);
    setConfirmations(prev =>
      prev.map(c =>
        c.rowIndex === rowIndex
          ? {
              ...c,
              suggestedUserId: userId,
              suggestedUserName: user?.full_name || null,
              confidence: 1, // Manual selection = full confidence
              isConfirmed: true,
            }
          : c
      )
    );
  };

  const handleConfirmAll = () => {
    setConfirmations(prev =>
      prev.map(c =>
        !c.isSkipped && c.suggestedUserId
          ? { ...c, isConfirmed: true }
          : c
      )
    );
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(confirmations.filter(c => c.isConfirmed && c.suggestedUserId));
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  const confirmedCount = confirmations.filter(c => c.isConfirmed && c.suggestedUserId).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col min-h-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Confirm Advisor Mappings
          </DialogTitle>
          <DialogDescription>
            Review detected advisors and confirm which ones to map. 
            {templateCount > 0 && (
              <span className="text-primary font-medium">
                {" "}The {templateCount} preset KPI columns will be auto-applied.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 py-3 px-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600">
              {stats.confirmed} Confirmed
            </Badge>
          </div>
          {stats.needsReview > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              {stats.needsReview} Need Review
            </Badge>
          )}
          {stats.unmatched > 0 && (
            <Badge variant="outline" className="border-destructive text-destructive">
              {stats.unmatched} Unmatched
            </Badge>
          )}
          {stats.skipped > 0 && (
            <Badge variant="secondary">
              {stats.skipped} Skipped
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConfirmAll}
              disabled={stats.needsReview === 0 && stats.unmatched === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Confirm All Matched
            </Button>
          </div>
        </div>

        {/* Advisor List */}
        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-2 py-2">
            {confirmations.map((conf) => (
              <div
                key={conf.rowIndex}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  conf.isSkipped && "opacity-50 bg-muted/30",
                  conf.isConfirmed && conf.suggestedUserId && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                  !conf.isSkipped && !conf.suggestedUserId && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                )}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={conf.isConfirmed}
                  onCheckedChange={() => handleToggleConfirm(conf.rowIndex)}
                  disabled={conf.isSkipped || !conf.suggestedUserId}
                />

                {/* Excel Name */}
                <div className="w-40 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{conf.excelName}</span>
                    {conf.isTotalsRow && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                        Dept Totals
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Row {conf.rowIndex + 1}</div>
                </div>

                {/* Arrow */}
                <span className="text-muted-foreground">→</span>

                {/* User Selection */}
                <div className="flex-1 min-w-0">
                  {conf.isSkipped ? (
                    <span className="text-sm text-muted-foreground italic">
                      Totals row (skipped)
                    </span>
                  ) : (
                    <Select
                      value={conf.suggestedUserId || ""}
                      onValueChange={(value) => handleChangeUser(conf.rowIndex, value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {storeUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Confidence */}
                {!conf.isSkipped && conf.suggestedUserId && (
                  <div className="shrink-0 w-16">
                    {conf.confidence >= 0.9 ? (
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 border-green-300 text-green-700 dark:text-green-400">
                        {Math.round(conf.confidence * 100)}%
                      </Badge>
                    ) : conf.confidence >= 0.7 ? (
                      <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-400">
                        {Math.round(conf.confidence * 100)}%
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {Math.round(conf.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                )}

                {!conf.isSkipped && !conf.suggestedUserId && (
                  <div className="shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Progress */}
        <div className="py-3 border-t">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Ready to map</span>
            <span className="font-medium">{confirmedCount} of {stats.total} advisors</span>
          </div>
          <Progress value={(confirmedCount / Math.max(stats.total, 1)) * 100} className="h-2" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={confirmedCount === 0 || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Apply Mappings ({confirmedCount} advisors × {templateCount} KPIs)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
