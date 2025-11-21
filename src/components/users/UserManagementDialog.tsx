import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Loader2, Save, UserPlus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  store_id: string | null;
  store_group_id: string | null;
  user_role?: string; // Role from user_roles table
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStoreId?: string | null;
}

export const UserManagementDialog = ({ open, onOpenChange, currentStoreId }: UserManagementDialogProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [storeGroups, setStoreGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadStores();
      loadStoreGroups();
    }
  }, [open, currentStoreId]);

  const loadStores = async () => {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .order("name");
    
    if (data) {
      setStores(data);
    }
  };

  const loadStoreGroups = async () => {
    const { data } = await supabase
      .from("store_groups")
      .select("*")
      .order("name");
    
    if (data) {
      setStoreGroups(data);
    }
  };

  const loadProfiles = async () => {
    setLoading(true);
    
    let query = supabase
      .from("profiles")
      .select("*");
    
    // Filter by current store if provided
    // Show users from the current store or users in a store group that contains this store
    if (currentStoreId) {
      // Get the store's group_id
      const { data: storeData } = await supabase
        .from("stores")
        .select("group_id")
        .eq("id", currentStoreId)
        .single();
      
      // Build filter: users from this store OR users from this store's group
      if (storeData?.group_id) {
        query = query.or(`store_id.eq.${currentStoreId},store_group_id.eq.${storeData.group_id}`);
      } else {
        query = query.eq("store_id", currentStoreId);
      }
    }
    
    const { data, error } = await query.order("full_name");

    if (error) {
      console.error("Error loading profiles:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } else {
      // Load user roles for each profile
      const profilesWithRoles = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();
          
          return {
            ...profile,
            user_role: roleData?.role || profile.role
          };
        })
      );
      setProfiles(profilesWithRoles);
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

  const updateProfileField = (profileId: string, field: keyof Profile, value: string | number | null) => {
    setProfiles(profiles.map(p => 
      p.id === profileId ? { ...p, [field]: value } : p
    ));
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // First, delete existing role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Then insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: userId,
          role: newRole as any
        }]);

      if (error) throw error;

      toast({ title: "Success", description: "User role updated successfully" });
      loadProfiles();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update user role. Only super admins can change roles.",
        variant: "destructive" 
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(userToDelete.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.id },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      // Reload profiles
      await loadProfiles();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const openDeleteDialog = (profile: Profile) => {
    setUserToDelete(profile);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <AddUserDialog 
        open={addUserOpen} 
        onOpenChange={setAddUserOpen}
        onUserCreated={loadProfiles}
        currentStoreId={currentStoreId}
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
                  <TableHead className="min-w-[150px]">Role</TableHead>
                  <TableHead className="min-w-[150px]">Store / Group</TableHead>
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
                      <Select
                        value={profile.user_role || profile.role}
                        onValueChange={(value) => handleUpdateRole(profile.id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="store_gm">Store GM</SelectItem>
                          <SelectItem value="department_manager">Department Manager</SelectItem>
                          <SelectItem value="read_only">Read Only</SelectItem>
                          <SelectItem value="sales_advisor">Sales Advisor</SelectItem>
                          <SelectItem value="service_advisor">Service Advisor</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="parts_advisor">Parts Advisor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {profile.store_group_id ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          Group: {storeGroups.find(g => g.id === profile.store_group_id)?.name || 'Unknown'}
                        </span>
                      ) : profile.store_id ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          {stores.find(s => s.id === profile.store_id)?.name || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
                      <div className="flex gap-2 justify-end">
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
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(profile)}
                          disabled={deleting === profile.id}
                        >
                          {deleting === profile.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.full_name}</strong> ({userToDelete?.email})?
              This action cannot be undone and will permanently remove the user and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
