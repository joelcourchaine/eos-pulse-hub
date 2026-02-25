import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember } from "./ReverseOrgChart";

const POSITION_OPTIONS = [
  { value: "service_manager", label: "Service Manager" },
  { value: "foreman", label: "Foreman / Shop Foreman" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "advisor", label: "Advisor" },
  { value: "junior_advisor", label: "Junior Advisor" },
  { value: "internal_advisor", label: "Internal Advisor" },
  { value: "technician", label: "Technician" },
  { value: "lube_technician", label: "Lube Technician" },
  { value: "apprentice_1", label: "1st Year Apprentice" },
  { value: "apprentice_2", label: "2nd Year Apprentice" },
  { value: "apprentice_3", label: "3rd Year Apprentice" },
  { value: "apprentice_4", label: "4th Year Apprentice" },
  { value: "red_seal_technician", label: "Red Seal Technician" },
  { value: "porter", label: "Porter" },
  { value: "warranty_admin", label: "Warranty Admin" },
  { value: "detailer", label: "Detailer" },
  { value: "administrative", label: "Administrative" },
  { value: "cashier", label: "Cashier" },
  { value: "detail_manager", label: "Detail Manager" },
];

interface AddTeamMemberDialogProps {
  storeId: string;
  existingMembers: TeamMember[];
  onAdded: () => void;
}

export const AddTeamMemberDialog = ({ storeId, existingMembers, onAdded }: AddTeamMemberDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [positionSecondary, setPositionSecondary] = useState("none");
  const [reportsTo, setReportsTo] = useState<string>("none");
  const [isVacant, setIsVacant] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!position) {
      toast({ title: "Missing fields", description: "Position is required.", variant: "destructive" });
      return;
    }
    if (!isVacant && !name.trim()) {
      toast({ title: "Missing fields", description: "Name is required for non-vacant positions.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("team_members").insert({
        store_id: storeId,
        created_by: user?.id,
        name: isVacant && !name.trim() ? "Vacant" : name.trim(),
        position,
        position_secondary: positionSecondary === "none" ? null : positionSecondary,
        reports_to: reportsTo === "none" ? null : reportsTo,
        status: isVacant ? "vacant" : "active",
      });

      if (error) throw error;

      toast({ title: "Team member added" });
      setName("");
      setPosition("");
      setPositionSecondary("none");
      setReportsTo("none");
      setIsVacant(false);
      setOpen(false);
      onAdded();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Team Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className={isVacant ? "text-muted-foreground" : ""}>Name {isVacant && <span className="text-xs">(optional for vacant)</span>}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isVacant ? "Leave blank to use 'Vacant'" : "Full name"} disabled={false} className={isVacant ? "opacity-60" : ""} />
          </div>

          <div className="space-y-2">
            <Label>Primary Position</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Secondary Position <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={positionSecondary} onValueChange={setPositionSecondary}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {POSITION_OPTIONS.filter((p) => p.value !== position).map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reports To</Label>
            <Select value={reportsTo} onValueChange={setReportsTo}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (Root) —</SelectItem>
                {existingMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({POSITION_OPTIONS.find(p => p.value === m.position)?.label || m.position})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="vacant" checked={isVacant} onCheckedChange={setIsVacant} />
            <Label htmlFor="vacant">Mark as Vacant</Label>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Add Member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
