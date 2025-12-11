import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Loader2, Save, UserPlus, Trash2, Mail } from "lucide-react";
import { DepartmentAccessDialog } from "./DepartmentAccessDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserGroupId, setCurrentUserGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check current user's role and group
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if super admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      
      setIsSuperAdmin(!!roleData);

      // Get current user's store group
      const { data: profileData } = await supabase
        .from("profiles")
        .select("store_group_id")
        .eq("id", user.id)
        .single();
      
      setCurrentUserGroupId(profileData?.store_group_id || null);
    };

    if (open) {
      checkUserRole();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadStores();
      loadStoreGroups();
      loadDepartments();
    }
  }, [open, currentStoreId, isSuperAdmin, currentUserGroupId]);

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
    let query = supabase
      .from("store_groups")
      .select("*")
      .order("name");
    
    // Non-super-admins can only see their own store group
    if (!isSuperAdmin && currentUserGroupId) {
      query = query.eq("id", currentUserGroupId);
    }
    
    const { data } = await query;
    
    if (data) {
      setStoreGroups(data);
    }
  };

  const loadDepartments = async () => {
    let query = supabase
      .from("departments")
      .select("*")
      .order("name");
    
    // Filter by current store if provided
    if (currentStoreId) {
      query = query.eq("store_id", currentStoreId);
    }
    
    const { data } = await query;
    
    if (data) {
      setDepartments(data);
    }
  };

  const loadProfiles = async () => {
    setLoading(true);
    
    let userIds: string[] = [];
    
    if (currentStoreId) {
      // Get users directly assigned to this store
      const { data: storeUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("store_id", currentStoreId);
      
      userIds = storeUsers?.map(u => u.id) || [];
      
      // Get users who are assigned to KPIs in this store's departments
      const { data: departments } = await supabase
        .from("departments")
        .select("id")
        .eq("store_id", currentStoreId);
      
      const departmentIds = departments?.map(d => d.id) || [];
      
      if (departmentIds.length > 0) {
        const { data: kpiOwners } = await supabase
          .from("kpi_definitions")
          .select("assigned_to")
          .in("department_id", departmentIds)
          .not("assigned_to", "is", null);
        
        const kpiOwnerIds = kpiOwners?.map(k => k.assigned_to).filter(Boolean) as string[] || [];
        userIds = [...userIds, ...kpiOwnerIds];
      }
      
      // Always include super-admins (they can manage all stores)
      const { data: superAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      
      const superAdminIds = superAdmins?.map(sa => sa.user_id) || [];
      userIds = [...userIds, ...superAdminIds];
      
      // Remove duplicates
      userIds = [...new Set(userIds)];
    }
    
    // Fetch all profiles
    let query = supabase
      .from("profiles")
      .select("*");
    
    // Apply filter when viewing a specific store
    if (currentStoreId) {
      if (userIds.length > 0) {
        query = query.in("id", userIds);
      } else {
        // If no users found, return empty result instead of all users
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
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
    email?: string;
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

  const handleUpdateManagedDepartment = async (userId: string, newDepartmentId: string | null) => {
    try {
      // Get current user for granted_by field
      const { data: { user } } = await supabase.auth.getUser();

      // First, unassign this user from any departments they currently manage
      await supabase
        .from("departments")
        .update({ manager_id: null })
        .eq("manager_id", userId);

      // Then assign to new department if one was selected
      if (newDepartmentId) {
        // First unassign any other manager from this department
        await supabase
          .from("departments")
          .update({ manager_id: null })
          .eq("id", newDepartmentId);
        
        // Then assign this user
        const { error } = await supabase
          .from("departments")
          .update({ manager_id: userId })
          .eq("id", newDepartmentId);

        if (error) throw error;

        // Also add to user_department_access table
        const { error: accessError } = await supabase
          .from("user_department_access")
          .upsert({
            user_id: userId,
            department_id: newDepartmentId,
            granted_by: user?.id
          }, {
            onConflict: 'user_id,department_id'
          });

        if (accessError) throw accessError;
      }

      toast({ title: "Success", description: "Department assignment updated successfully" });
      loadProfiles();
      loadDepartments();
    } catch (error: any) {
      console.error("Error updating department:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update department assignment.",
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

  const handleResendInvite = async (userId: string) => {
    setResendingInvite(userId);
    try {
      const { data, error } = await supabase.functions.invoke('resend-user-invite', {
        body: { user_id: userId },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to resend invitation');
      }

      toast({
        title: "Success",
        description: "Invitation email sent successfully",
      });
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation email",
        variant: "destructive",
      });
    } finally {
      setResendingInvite(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'department_manager':
        return 'hsl(142 76% 36%)'; // Green
      case 'service_advisor':
        return 'hsl(221 83% 53%)'; // Blue
      case 'technician':
        return 'hsl(25 95% 53%)'; // Orange
      default:
        return 'hsl(var(--muted))';
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return '??';
    }
    const trimmedName = name.trim();
    const parts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      const firstInitial = parts[0][0] || '';
      const lastInitial = parts[parts.length - 1][0] || '';
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
    return '??';
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
          <div className="overflow-x-auto relative">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[140px]">Name</TableHead>
                  <TableHead className="min-w-[160px]">Email</TableHead>
                  <TableHead className="min-w-[110px]">Role</TableHead>
                  <TableHead className="min-w-[100px]">Store/Group</TableHead>
                  <TableHead className="min-w-[110px]">Manages Dept</TableHead>
                  <TableHead className="min-w-[90px]">BD Month</TableHead>
                  <TableHead className="min-w-[70px]">BD Day</TableHead>
                  <TableHead className="min-w-[90px]">Start Mo</TableHead>
                  <TableHead className="min-w-[70px]">Start Yr</TableHead>
                  <TableHead className="min-w-[110px]">Reports To</TableHead>
                  <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="sticky left-0 z-10 bg-background">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback 
                            style={{ backgroundColor: getRoleColor(profile.user_role || profile.role) }}
                            className="text-white text-[10px] font-medium"
                          >
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <Input
                          value={profile.full_name}
                          onChange={(e) => updateProfileField(profile.id, "full_name", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={(e) => updateProfileField(profile.id, "email", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={profile.user_role || profile.role}
                        onValueChange={(value) => handleUpdateRole(profile.id, value)}
                        disabled={!isSuperAdmin && profile.user_role === 'super_admin'}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                          <SelectItem value="store_gm">Store GM</SelectItem>
                          <SelectItem value="department_manager">Dept Manager</SelectItem>
                          <SelectItem value="read_only">Read Only</SelectItem>
                          <SelectItem value="sales_advisor">Sales Advisor</SelectItem>
                          <SelectItem value="service_advisor">Service Advisor</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="parts_advisor">Parts Advisor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      {profile.store_id ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          {stores.find(s => s.id === profile.store_id)?.name || 'Unknown'}
                        </span>
                      ) : profile.store_group_id ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          Group: {storeGroups.find(g => g.id === profile.store_group_id)?.name || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={departments.find(d => d.manager_id === profile.id)?.id || "none"}
                        onValueChange={(value) => handleUpdateManagedDepartment(profile.id, value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {departments.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.birthday_month || ""}
                        onChange={(e) => updateProfileField(profile.id, "birthday_month", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.birthday_day || ""}
                        onChange={(e) => updateProfileField(profile.id, "birthday_day", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                        className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">-</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={profile.start_year || ""}
                        onChange={(e) => updateProfileField(profile.id, "start_year", e.target.value ? parseInt(e.target.value) : null)}
                        className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                        <SelectTrigger className="h-7 text-xs">
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
                      <div className="flex gap-1 justify-end">
                        <DepartmentAccessDialog
                          userId={profile.id}
                          userName={profile.full_name}
                          currentStoreId={currentStoreId}
                          onAccessUpdated={loadProfiles}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleUpdateProfile(profile.id, {
                            full_name: profile.full_name,
                            email: profile.email,
                            birthday_month: profile.birthday_month,
                            birthday_day: profile.birthday_day,
                            start_month: profile.start_month,
                            start_year: profile.start_year,
                            reports_to: profile.reports_to,
                          })}
                          disabled={saving === profile.id}
                        >
                          {saving === profile.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleResendInvite(profile.id)}
                          disabled={resendingInvite === profile.id}
                          title="Resend invitation email"
                        >
                          {resendingInvite === profile.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2"
                          onClick={() => openDeleteDialog(profile)}
                          disabled={deleting === profile.id}
                        >
                          {deleting === profile.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
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
