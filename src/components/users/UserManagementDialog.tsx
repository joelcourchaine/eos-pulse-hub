import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Loader2, Save, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddUserDialog } from "./AddUserDialog";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  birthday_month: number | null;
  birthday_day: number | null;
  start_month: number | null;
  start_year: number | null;
  role: string;
  reports_to: string | null;
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserManagementDialog = ({ open, onOpenChange }: UserManagementDialogProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (error) {
      console.error("Error loading profiles:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async (profileId: string, updates: {
    full_name?: string;
    birthday_month?: number | null;
    birthday_day?: number | null;
    start_month?: number | null;
    start_year?: number | null;
    reports_to?: string | null;
  }) => {
    setSaving(profileId);

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profileId);

    if (error) {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "User updated successfully" });
      loadProfiles();
    }

    setSaving(null);
  };

  const updateProfileField = (profileId: string, field: keyof Profile, value: string | number) => {
    setProfiles(profiles.map(p => 
      p.id === profileId ? { ...p, [field]: value } : p
    ));
  };

  return (
    <>
      <AddUserDialog 
        open={addUserOpen} 
        onOpenChange={setAddUserOpen}
        onUserCreated={loadProfiles}
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>User Management</DialogTitle>
                <DialogDescription>
                  View and edit user information including birthdays and work anniversaries
                </DialogDescription>
              </div>
              <Button onClick={() => setAddUserOpen(true)} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">Birthday Month</TableHead>
                  <TableHead className="min-w-[100px]">Birthday Day</TableHead>
                  <TableHead className="min-w-[120px]">Start Month</TableHead>
                  <TableHead className="min-w-[100px]">Start Year</TableHead>
                  <TableHead className="min-w-[150px]">Reports To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <Input
                        value={profile.full_name}
                        onChange={(e) => updateProfileField(profile.id, "full_name", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profile.email}
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.birthday_month || ""}
                        onChange={(e) => updateProfileField(profile.id, "birthday_month", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.birthday_day || ""}
                        onChange={(e) => updateProfileField(profile.id, "birthday_day", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 31 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.start_month || ""}
                        onChange={(e) => updateProfileField(profile.id, "start_month", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.start_year || ""}
                        onChange={(e) => updateProfileField(profile.id, "start_year", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 51 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={profile.reports_to || "none"}
                        onValueChange={(value) => updateProfileField(profile.id, "reports_to", value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {profiles
                            .filter(p => p.id !== profile.id)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.full_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateProfile(profile.id, {
                          full_name: profile.full_name,
                          birthday_month: profile.birthday_month,
                          birthday_day: profile.birthday_day,
                          start_month: profile.start_month,
                          start_year: profile.start_year,
                          reports_to: profile.reports_to,
                        })}
                        disabled={saving === profile.id}
                      >
                        {saving === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
};
