import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Search, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fuzzyNameMatch } from "@/utils/scorecardImportMatcher";

interface StoreUser {
  id: string;
  full_name: string | null;
}

interface UserMappingPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisorName: string;
  rowIndex: number;
  currentUserId: string | null;
  storeUsers: StoreUser[];
  onSave: (mapping: {
    rowIndex: number;
    advisorName: string;
    userId: string;
    profileName: string;
  }) => void;
  onRemove: (rowIndex: number) => void;
  children?: React.ReactNode; // Made optional since Dialog doesn't need trigger
}

export const UserMappingPopover = ({
  open,
  onOpenChange,
  advisorName,
  rowIndex,
  currentUserId,
  storeUsers,
  onSave,
  onRemove,
}: UserMappingPopoverProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentUserId);

  // Sort users by match score to the advisor name
  const sortedUsers = useMemo(() => {
    const usersWithScores = storeUsers.map((user) => ({
      ...user,
      matchScore: user.full_name ? fuzzyNameMatch(advisorName, user.full_name) : 0,
    }));

    return usersWithScores
      .filter((u) => {
        if (!searchQuery) return true;
        return (
          u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
        );
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [storeUsers, advisorName, searchQuery]);

  const handleSave = () => {
    if (!selectedUserId) return;
    const user = storeUsers.find((u) => u.id === selectedUserId);
    if (!user) return;

    onSave({
      rowIndex,
      advisorName,
      userId: selectedUserId,
      profileName: user.full_name || "Unknown",
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove(rowIndex);
    onOpenChange(false);
  };

  const getMatchBadge = (score: number) => {
    if (score >= 0.9) return { text: "Exact", className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" };
    if (score >= 0.7) return { text: "High", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" };
    if (score >= 0.5) return { text: "Partial", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" };
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Map Advisor to User
          </DialogTitle>
          <DialogDescription>
            Link "<span className="font-medium text-foreground">{advisorName}</span>" to a system user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-1">
              {sortedUsers.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No users found
                </div>
              ) : (
                sortedUsers.map((user) => {
                  const badge = getMatchBadge(user.matchScore);
                  const isSelected = selectedUserId === user.id;

                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <User className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-sm truncate">
                        {user.full_name || "Unnamed User"}
                      </span>
                      {badge && !isSelected && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded font-medium",
                            badge.className
                          )}
                        >
                          {badge.text}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={!selectedUserId}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-2" />
              Save & Set as Owner
            </Button>
            {currentUserId && (
              <Button variant="destructive" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
