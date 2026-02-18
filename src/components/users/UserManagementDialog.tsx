import { useState, useEffect, useCallback, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, UserPlus, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";
import { DepartmentAccessDialog } from "./DepartmentAccessDialog";
import { ManagedDepartmentsSelect } from "./ManagedDepartmentsSelect";
import { ManagedStoresSelect } from "./ManagedStoresSelect";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddUserDialog } from "./AddUserDialog";

// Debounced input component to prevent lag during typing
const DebouncedInput = memo(
  ({
    defaultValue,
    onDebouncedChange,
    className,
    type = "text",
  }: {
    defaultValue: string;
    onDebouncedChange: (value: string) => void;
    className?: string;
    type?: string;
  }) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
      setValue(defaultValue);
    }, [defaultValue]);

    useEffect(() => {
      const timer = setTimeout(() => {
        if (value !== defaultValue) {
          onDebouncedChange(value);
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [value, defaultValue, onDebouncedChange]);

    return <Input type={type} value={value} onChange={(e) => setValue(e.target.value)} className={className} />;
  },
);

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
  last_sign_in_at: string | null;
  last_active_at: string | null;
  created_at: string;
  invited_at: string | null;
  user_role?: string; // Role from user_roles table
}

// Helper to check if user has actually logged in (not just created via admin API)
const hasActuallyLoggedIn = (profile: Profile): boolean => {
  if (profile.last_active_at) return true;
  if (!profile.last_sign_in_at) return false;

  const lastLogin = new Date(profile.last_sign_in_at).getTime();
  const createdAt = new Date(profile.created_at).getTime();

  // If last_sign_in_at is within 60 seconds of created_at, it's just the creation timestamp
  return Math.abs(lastLogin - createdAt) > 60000;
};

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
  const [isStoreGM, setIsStoreGM] = useState(false);
  const [currentUserGroupId, setCurrentUserGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Check current user's role and group
  useEffect(() => {
    const checkUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check user roles
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      const roles = roleData?.map((r) => r.role) || [];
      setIsSuperAdmin(roles.includes("super_admin"));
      setIsStoreGM(roles.includes("store_gm"));

      // Get current user's store group
      const { data: profileData } = await supabase.from("profiles").select("store_group_id").eq("id", user.id).single();

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
    let query = supabase.from("stores").select("*").order("name");

    // Non-super-admins can only see stores in their group
    if (!isSuperAdmin && currentUserGroupId) {
      query = query.eq("group_id", currentUserGroupId);
    }

    const { data } = await query;

    if (data) {
      setStores(data);
    }
  };

  const loadStoreGroups = async () => {
    let query = supabase.from("store_groups").select("*").order("name");

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
    let query = supabase.from("departments").select("*").order("name");

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
      // Run all queries in parallel for better performance
      const [storeResult, storeUsersResult, storeAccessResult, departmentsResult, superAdminsResult] =
        await Promise.all([
          supabase.from("stores").select("group_id").eq("id", currentStoreId).single(),
          supabase.from("profiles").select("id").eq("store_id", currentStoreId),
          supabase.from("user_store_access").select("user_id").eq("store_id", currentStoreId),
          supabase.from("departments").select("id").eq("store_id", currentStoreId),
          supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
        ]);

      const storeGroupId = storeResult.data?.group_id;

      // Collect user IDs from parallel results
      userIds = storeUsersResult.data?.map((u) => u.id) || [];
      userIds = [...userIds, ...(storeAccessResult.data?.map((u) => u.user_id) || [])];
      userIds = [...userIds, ...(superAdminsResult.data?.map((sa) => sa.user_id) || [])];

      // Secondary parallel queries that depend on first results
      const departmentIds = departmentsResult.data?.map((d) => d.id) || [];

      const [groupUsersResult, kpiOwnersResult] = await Promise.all([
        storeGroupId
          ? supabase.from("profiles").select("id").eq("store_group_id", storeGroupId).is("store_id", null)
          : Promise.resolve({ data: null }),
        departmentIds.length > 0
          ? supabase
              .from("kpi_definitions")
              .select("assigned_to")
              .in("department_id", departmentIds)
              .not("assigned_to", "is", null)
          : Promise.resolve({ data: null }),
      ]);

      if (groupUsersResult.data) {
        userIds = [...userIds, ...groupUsersResult.data.map((u) => u.id)];
      }

      if (kpiOwnersResult.data) {
        const kpiOwnerIds = kpiOwnersResult.data.map((k) => k.assigned_to).filter(Boolean) as string[];
        userIds = [...userIds, ...kpiOwnerIds];
      }

      // Remove duplicates
      userIds = [...new Set(userIds)];
    }

    // Fetch all profiles with sensitive data from joined table, excluding system users
    let query = supabase
      .from("profiles")
      .select("*, profile_sensitive_data(birthday_month, birthday_day, start_month, start_year)")
      .eq("is_system_user", false);

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
      // Load user roles for all profiles in a single batch query
      const profileIds = (data || []).map((p) => p.id);
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", profileIds);

      // Create a map for quick lookup
      const roleMap = new Map<string, string>();
      allRoles?.forEach((r) => roleMap.set(r.user_id, r.role));

      const profilesWithRoles = (data || []).map((profile) => {
        // Flatten joined sensitive data onto the profile object
        const sensitive = (profile as any).profile_sensitive_data;
        return {
          ...profile,
          birthday_month: sensitive?.birthday_month ?? profile.birthday_month ?? null,
          birthday_day: sensitive?.birthday_day ?? profile.birthday_day ?? null,
          start_month: sensitive?.start_month ?? profile.start_month ?? null,
          start_year: sensitive?.start_year ?? profile.start_year ?? null,
          user_role: roleMap.get(profile.id) || profile.role,
        };
      });
      setProfiles(profilesWithRoles);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async (
    profileId: string,
    updates: {
      full_name?: string;
      email?: string;
      birthday_month?: number | null;
      birthday_day?: number | null;
      start_month?: number | null;
      start_year?: number | null;
      reports_to?: string | null;
    },
  ) => {
    setSaving(profileId);

    // Separate profile fields from sensitive fields
    const { birthday_month, birthday_day, start_month, start_year, ...profileUpdates } = updates;

    // Update non-sensitive profile fields
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", profileId);

    if (error) {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    } else {
      // Write sensitive fields to profile_sensitive_data
      const hasSensitiveUpdate =
        birthday_month !== undefined ||
        birthday_day !== undefined ||
        start_month !== undefined ||
        start_year !== undefined;

      if (hasSensitiveUpdate) {
        const { error: sensitiveError } = await (supabase.from as any)("profile_sensitive_data").upsert(
          {
            id: profileId,
            birthday_month: birthday_month ?? null,
            birthday_day: birthday_day ?? null,
            start_month: start_month ?? null,
            start_year: start_year ?? null,
          },
          { onConflict: "id" },
        );
        if (sensitiveError) {
          console.error("Error upserting profile_sensitive_data:", sensitiveError);
        }
      }

      toast({ title: "Success", description: "User updated successfully" });
      loadProfiles();
    }

    setSaving(null);
  };

  const updateProfileField = useCallback((profileId: string, field: keyof Profile, value: string | number | null) => {
    setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, [field]: value } : p)));
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // First, delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then insert new role
      const { error } = await supabase.from("user_roles").insert([
        {
          user_id: userId,
          role: newRole as any,
        },
      ]);

      if (error) throw error;

      toast({ title: "Success", description: "User role updated successfully" });
      loadProfiles();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user role. Only super admins can change roles.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateManagedDepartment = async (userId: string, newDepartmentId: string | null) => {
    try {
      // Get current user for granted_by field
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // First, unassign this user from any departments they currently manage
      await supabase.from("departments").update({ manager_id: null }).eq("manager_id", userId);

      // Then assign to new department if one was selected
      if (newDepartmentId) {
        // First unassign any other manager from this department
        await supabase.from("departments").update({ manager_id: null }).eq("id", newDepartmentId);

        // Then assign this user
        const { error } = await supabase.from("departments").update({ manager_id: userId }).eq("id", newDepartmentId);

        if (error) throw error;

        // Also add to user_department_access table
        const { error: accessError } = await supabase.from("user_department_access").upsert(
          {
            user_id: userId,
            department_id: newDepartmentId,
            granted_by: user?.id,
          },
          {
            onConflict: "user_id,department_id",
          },
        );

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
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(userToDelete.id);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userToDelete.id },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      // Reload profiles
      await loadProfiles();
    } catch (error: any) {
      console.error("Error deleting user:", error);
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
      const { data, error } = await supabase.functions.invoke("resend-user-invite", {
        body: { user_id: userId },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to resend invitation");
      }

      toast({
        title: "Success",
        description: "Invitation email sent successfully",
      });

      // Reload profiles to show updated invited_at date
      await loadProfiles();
    } catch (error: any) {
      console.error("Error resending invitation:", error);
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
      case "department_manager":
      case "fixed_ops_manager":
        return "hsl(142 76% 36%)"; // Green
      case "service_advisor":
        return "hsl(221 83% 53%)"; // Blue
      case "technician":
        return "hsl(25 95% 53%)"; // Orange
      default:
        return "hsl(var(--muted))";
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== "string" || name.trim() === "") {
      return "??";
    }
    const trimmedName = name.trim();
    const parts = trimmedName.split(/\s+/).filter((part) => part.length > 0);

    if (parts.length >= 2) {
      const firstInitial = parts[0][0] || "";
      const lastInitial = parts[parts.length - 1][0] || "";
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
    return "??";
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
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
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
            <div className="overflow-x-scroll relative">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-background min-w-[140px]">Name</TableHead>
                    <TableHead className="min-w-[220px]">Email</TableHead>
                    <TableHead className="min-w-[110px]">Role</TableHead>
                    <TableHead className="min-w-[140px]">Store Access</TableHead>
                    <TableHead className="min-w-[110px]">Manages Dept</TableHead>
                    <TableHead className="min-w-[90px]">BD Month</TableHead>
                    <TableHead className="min-w-[70px]">BD Day</TableHead>
                    <TableHead className="min-w-[90px]">Start Mo</TableHead>
                    <TableHead className="min-w-[70px]">Start Yr</TableHead>
                    <TableHead className="min-w-[110px]">Reports To</TableHead>
                    <TableHead className="min-w-[90px]">Invited</TableHead>
                    <TableHead className="min-w-[100px]">Last Login</TableHead>
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
                          <DebouncedInput
                            defaultValue={profile.full_name}
                            onDebouncedChange={(value) => updateProfileField(profile.id, "full_name", value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <DebouncedInput
                          type="email"
                          defaultValue={profile.email}
                          onDebouncedChange={(value) => updateProfileField(profile.id, "email", value)}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={profile.user_role || profile.role}
                          onValueChange={(value) => handleUpdateRole(profile.id, value)}
                          disabled={!isSuperAdmin && profile.user_role === "super_admin"}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                            {isSuperAdmin && <SelectItem value="consulting_scheduler">Consulting Scheduler</SelectItem>}
                            {(isSuperAdmin || isStoreGM) && <SelectItem value="store_gm">Store GM</SelectItem>}
                            {(isSuperAdmin || isStoreGM) && <SelectItem value="controller">Controller</SelectItem>}
                            <SelectItem value="department_manager">Dept Manager</SelectItem>
                            <SelectItem value="fixed_ops_manager">Fixed Ops Manager</SelectItem>
                            <SelectItem value="read_only">Read Only</SelectItem>
                            <SelectItem value="sales_advisor">Sales Advisor</SelectItem>
                            <SelectItem value="service_advisor">Service Advisor</SelectItem>
                            <SelectItem value="technician">Technician</SelectItem>
                            <SelectItem value="parts_advisor">Parts Advisor</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <ManagedStoresSelect
                          userId={profile.id}
                          stores={stores}
                          storeGroups={storeGroups}
                          userStoreGroupId={profile.store_group_id}
                          userStoreId={profile.store_id}
                          onUpdate={loadProfiles}
                          isSuperAdmin={isSuperAdmin}
                        />
                      </TableCell>
                      <TableCell>
                        <ManagedDepartmentsSelect
                          userId={profile.id}
                          departments={departments}
                          onUpdate={() => {
                            loadProfiles();
                            loadDepartments();
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={profile.birthday_month || ""}
                          onChange={(e) =>
                            updateProfileField(
                              profile.id,
                              "birthday_month",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
                          className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">-</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {new Date(2000, i).toLocaleString("default", { month: "short" })}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          value={profile.birthday_day || ""}
                          onChange={(e) =>
                            updateProfileField(
                              profile.id,
                              "birthday_day",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
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
                          onChange={(e) =>
                            updateProfileField(
                              profile.id,
                              "start_month",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
                          className="flex h-7 w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">-</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {new Date(2000, i).toLocaleString("default", { month: "short" })}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          value={profile.start_year || ""}
                          onChange={(e) =>
                            updateProfileField(
                              profile.id,
                              "start_year",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
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
                          onValueChange={(value) =>
                            updateProfileField(profile.id, "reports_to", value === "none" ? null : value)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {profiles
                              .filter((p) => p.id !== profile.id)
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {profile.invited_at ? format(new Date(profile.invited_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {hasActuallyLoggedIn(profile)
                          ? format(new Date((profile.last_active_at || profile.last_sign_in_at)!), "MMM d, yyyy")
                          : "Never"}
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
                            onClick={() =>
                              handleUpdateProfile(profile.id, {
                                full_name: profile.full_name,
                                email: profile.email,
                                birthday_month: profile.birthday_month,
                                birthday_day: profile.birthday_day,
                                start_month: profile.start_month,
                                start_year: profile.start_year,
                                reports_to: profile.reports_to,
                              })
                            }
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
              Are you sure you want to delete <strong>{userToDelete?.full_name}</strong> ({userToDelete?.email})? This
              action cannot be undone and will permanently remove the user and all associated data.
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
