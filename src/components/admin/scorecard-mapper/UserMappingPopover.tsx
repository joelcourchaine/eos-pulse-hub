import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  children: React.ReactNode;
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
  children,
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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Map Advisor to User</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Report name: <span className="font-medium">{advisorName}</span>
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <ScrollArea className="h-48 border rounded-md">
            <div className="p-1 space-y-0.5">
              {sortedUsers.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
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
                        "w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 text-xs truncate">
                        {user.full_name || "Unnamed User"}
                      </span>
                      {badge && !isSelected && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            badge.className
                          )}
                        >
                          {badge.text}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedUserId}
              className="flex-1"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save Mapping
            </Button>
            {currentUserId && (
              <Button size="sm" variant="destructive" onClick={handleRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
