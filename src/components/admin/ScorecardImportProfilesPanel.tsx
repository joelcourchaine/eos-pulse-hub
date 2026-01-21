import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { ScorecardImportProfileDialog } from "./ScorecardImportProfileDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ImportProfile {
  id: string;
  store_group_id: string | null;
  name: string;
  role_type: string;
  parser_type: string;
  is_active: boolean;
  created_at: string;
  store_groups?: { name: string } | null;
}

interface ScorecardImportProfilesPanelProps {
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
}

export const ScorecardImportProfilesPanel = ({
  selectedProfileId,
  onSelectProfile,
}: ScorecardImportProfilesPanelProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ImportProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["scorecard-import-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("*, store_groups(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ImportProfile[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scorecard_import_profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-import-profiles"] });
      toast({ title: "Profile deleted" });
      if (selectedProfileId === deleteId) {
        onSelectProfile(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleTypeLabel = (roleType: string) => {
    switch (roleType) {
      case "service_advisor": return "Service Advisor";
      case "technician": return "Technician";
      case "parts_advisor": return "Parts Advisor";
      default: return roleType;
    }
  };

  const getParserTypeLabel = (parserType: string) => {
    switch (parserType) {
      case "csr_productivity": return "CSR Productivity";
      case "technician_productivity": return "Technician Productivity";
      default: return parserType;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure report types and their parsing settings
        </p>
        <Button onClick={() => { setEditingProfile(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Profile
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Store Group</TableHead>
              <TableHead>Role Type</TableHead>
              <TableHead>Parser</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No import profiles configured yet
                </TableCell>
              </TableRow>
            ) : (
              profiles?.map((profile) => (
                <TableRow
                  key={profile.id}
                  className={selectedProfileId === profile.id ? "bg-muted/50" : "cursor-pointer hover:bg-muted/30"}
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <TableCell className="font-medium">{profile.name}</TableCell>
                  <TableCell>{profile.store_groups?.name || "All Groups"}</TableCell>
                  <TableCell>{getRoleTypeLabel(profile.role_type)}</TableCell>
                  <TableCell>{getParserTypeLabel(profile.parser_type)}</TableCell>
                  <TableCell>
                    {profile.is_active ? (
                      <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <X className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProfile(profile);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(profile.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ScorecardImportProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editingProfile}
        onSuccess={() => {
          setDialogOpen(false);
          setEditingProfile(null);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all column mappings associated with this profile.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
