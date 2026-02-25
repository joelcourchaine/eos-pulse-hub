import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
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
  { value: "porter", label: "Porter" },
  { value: "warranty_admin", label: "Warranty Admin" },
  { value: "detailer", label: "Detailer" },
  { value: "administrative", label: "Administrative" },
  { value: "cashier", label: "Cashier" },
  { value: "detail_manager", label: "Detail Manager" },
];

interface TeamMemberDetailPanelProps {
  member: TeamMember | null;
  allMembers: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const TeamMemberDetailPanel = ({ member, allMembers, open, onOpenChange, onUpdated }: TeamMemberDetailPanelProps) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [positionSecondary, setPositionSecondary] = useState("none");
  const [reportsTo, setReportsTo] = useState("none");
  const [isVacant, setIsVacant] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setPosition(member.position);
      setPositionSecondary(member.position_secondary || "none");
      setReportsTo(member.reports_to || "none");
      setIsVacant(member.status === "vacant");
    }
  }, [member]);

  if (!member) return null;

  const otherMembers = allMembers.filter((m) => m.id !== member.id);

  const handleSave = async () => {
    if (!position) return;
    if (!isVacant && !name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("team_members").update({
        name: isVacant && !name.trim() ? "Vacant" : name.trim(),
        position,
        position_secondary: positionSecondary === "none" ? null : positionSecondary,
        reports_to: reportsTo === "none" ? null : reportsTo,
        status: isVacant ? "vacant" : "active",
      }).eq("id", member.id);

      if (error) throw error;
      toast({ title: "Team member updated" });
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${member.name}? Team members reporting to them will be unlinked.`)) return;
    try {
      const { error } = await supabase.from("team_members").delete().eq("id", member.id);
      if (error) throw error;
      toast({ title: "Team member deleted" });
      onOpenChange(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Team Member</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className={isVacant ? "text-muted-foreground" : ""}>Name {isVacant && <span className="text-xs">(optional for vacant)</span>}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isVacant ? "Leave blank to use 'Vacant'" : "Full name"} className={isVacant ? "opacity-60" : ""} />
          </div>

          <div className="space-y-2">
            <Label>Primary Position</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (Root) —</SelectItem>
                {otherMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="edit-vacant" checked={isVacant} onCheckedChange={setIsVacant} />
            <Label htmlFor="edit-vacant">Vacant</Label>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save Changes"}
          </Button>

          <Button variant="destructive" onClick={handleDelete} className="w-full gap-1">
            <Trash2 className="h-4 w-4" /> Delete Member
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
