import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wand2, Loader2 } from "lucide-react";
import { fuzzyNameMatch } from "@/utils/scorecardImportMatcher";

interface UserAlias {
  id: string;
  store_id: string;
  alias_name: string;
  user_id: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

interface ScorecardUserAliasesPanelProps {
  selectedStoreId: string | null;
  onSelectStore: (id: string | null) => void;
}

export const ScorecardUserAliasesPanel = ({
  selectedStoreId,
  onSelectStore,
}: ScorecardUserAliasesPanelProps) => {
  const [newAlias, setNewAlias] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: aliases, isLoading: aliasesLoading } = useQuery({
    queryKey: ["scorecard-user-aliases", selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const { data, error } = await supabase
        .from("scorecard_user_aliases")
        .select("*, profiles!scorecard_user_aliases_user_id_fkey(full_name)")
        .eq("store_id", selectedStoreId)
        .order("alias_name");
      if (error) throw error;
      return data as UserAlias[];
    },
    enabled: !!selectedStoreId,
  });

  const { data: storeUsers } = useQuery({
    queryKey: ["store-users", selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("store_id", selectedStoreId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("scorecard_user_aliases")
        .insert({
          store_id: selectedStoreId,
          alias_name: newAlias,
          user_id: newUserId,
          created_by: userData.user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-user-aliases", selectedStoreId] });
      toast({ title: "Alias created" });
      setNewAlias("");
      setNewUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message.includes("duplicate") 
          ? "An alias with this name already exists"
          : error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scorecard_user_aliases")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-user-aliases", selectedStoreId] });
      toast({ title: "Alias deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: async () => {
      if (!storeUsers || !selectedStoreId) return 0;
      
      const { data: userData } = await supabase.auth.getUser();
      
      // Get existing aliases to avoid duplicates
      const existingNames = new Set(aliases?.map(a => a.alias_name.toLowerCase()) || []);
      
      let matchCount = 0;
      const newAliases: { store_id: string; alias_name: string; user_id: string; created_by: string | undefined }[] = [];
      
      // For each user, try to create an alias with variations of their name
      for (const user of storeUsers) {
        const names = user.full_name.split(" ");
        const variations = [
          user.full_name,
          // First Last
          `${names[0]} ${names[names.length - 1]}`,
          // Last, First
          `${names[names.length - 1]}, ${names[0]}`,
        ];
        
        for (const variation of variations) {
          if (!existingNames.has(variation.toLowerCase())) {
            newAliases.push({
              store_id: selectedStoreId,
              alias_name: variation,
              user_id: user.id,
              created_by: userData.user?.id,
            });
            existingNames.add(variation.toLowerCase());
            matchCount++;
          }
        }
      }
      
      if (newAliases.length > 0) {
        const { error } = await supabase
          .from("scorecard_user_aliases")
          .insert(newAliases);
        if (error) throw error;
      }
      
      return matchCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-user-aliases", selectedStoreId] });
      toast({ 
        title: "Auto-match complete", 
        description: `Created ${count} new aliases` 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!selectedStoreId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value="" onValueChange={onSelectStore}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a store..." />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a store to manage user name aliases for report imports
        </p>
      </div>
    );
  }

  if (aliasesLoading) {
    return <Skeleton className="h-60 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedStoreId} onValueChange={onSelectStore}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a store..." />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => autoMatchMutation.mutate()}
          disabled={autoMatchMutation.isPending}
        >
          {autoMatchMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          Auto-Generate Aliases
        </Button>
      </div>

      {/* Add new alias form */}
      <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/30">
        <Input
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="Report name (e.g., 'Kayla B.')"
          className="flex-1"
        />
        <Select value={newUserId} onValueChange={setNewUserId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {storeUsers?.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!newAlias || !newUserId || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alias Name</TableHead>
              <TableHead>Maps To</TableHead>
              <TableHead>Match Quality</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aliases?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No aliases configured. Add an alias or use "Auto-Generate Aliases" to get started.
                </TableCell>
              </TableRow>
            ) : (
              aliases?.map((alias) => {
                const matchScore = alias.profiles 
                  ? fuzzyNameMatch(alias.alias_name, alias.profiles.full_name)
                  : 0;
                return (
                  <TableRow key={alias.id}>
                    <TableCell className="font-mono">{alias.alias_name}</TableCell>
                    <TableCell>{alias.profiles?.full_name || "Unknown"}</TableCell>
                    <TableCell>
                      {matchScore >= 0.95 ? (
                        <Badge className="bg-green-500/20 text-green-700">Exact</Badge>
                      ) : matchScore >= 0.8 ? (
                        <Badge className="bg-yellow-500/20 text-yellow-700">Similar</Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-700">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(alias.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
