import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ImportProfile {
  id: string;
  store_group_id: string | null;
  name: string;
  role_type: string;
  parser_type: string;
  is_active: boolean;
}

interface ScorecardImportProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ImportProfile | null;
  onSuccess: () => void;
}

export const ScorecardImportProfileDialog = ({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: ScorecardImportProfileDialogProps) => {
  const [name, setName] = useState("");
  const [storeGroupId, setStoreGroupId] = useState<string>("all");
  const [roleType, setRoleType] = useState("service_advisor");
  const [parserType, setParserType] = useState("csr_productivity");
  const [isActive, setIsActive] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: storeGroups } = useQuery({
    queryKey: ["store-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_groups")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setStoreGroupId(profile.store_group_id || "all");
      setRoleType(profile.role_type);
      setParserType(profile.parser_type);
      setIsActive(profile.is_active);
    } else {
      setName("");
      setStoreGroupId("all");
      setRoleType("service_advisor");
      setParserType("csr_productivity");
      setIsActive(true);
    }
  }, [profile, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        store_group_id: storeGroupId === "all" ? null : storeGroupId,
        role_type: roleType,
        parser_type: parserType,
        is_active: isActive,
      };

      if (profile) {
        const { error } = await supabase
          .from("scorecard_import_profiles")
          .update(data)
          .eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scorecard_import_profiles")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-import-profiles"] });
      toast({ title: profile ? "Profile updated" : "Profile created" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{profile ? "Edit Import Profile" : "Create Import Profile"}</DialogTitle>
            <DialogDescription>
              Configure how a specific report type should be parsed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CSR Service Advisor Report"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeGroup">Store Group</Label>
              <Select value={storeGroupId} onValueChange={setStoreGroupId}>
                <SelectTrigger id="storeGroup">
                  <SelectValue placeholder="Select store group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {storeGroups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleType">Role Type</Label>
              <Select value={roleType} onValueChange={setRoleType}>
                <SelectTrigger id="roleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_advisor">Service Advisor</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="parts_advisor">Parts Advisor</SelectItem>
                  <SelectItem value="sales_advisor">Sales Advisor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parserType">Parser Type</Label>
              <Select value={parserType} onValueChange={setParserType}>
                <SelectTrigger id="parserType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csr_productivity">CSR Productivity Report</SelectItem>
                  <SelectItem value="technician_productivity">Technician Productivity</SelectItem>
                  <SelectItem value="generic_excel">Generic Excel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines how the Excel file will be parsed
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive profiles won't appear in the import dialog
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {profile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
