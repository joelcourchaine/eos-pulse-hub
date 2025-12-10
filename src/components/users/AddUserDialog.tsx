import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  currentStoreId?: string | null;
}

export const AddUserDialog = ({ open, onOpenChange, onUserCreated, currentStoreId }: AddUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("department_manager");
  const [storeId, setStoreId] = useState<string>(currentStoreId || "");
  const [storeGroupId, setStoreGroupId] = useState<string>("");
  const [stores, setStores] = useState<any[]>([]);
  const [storeGroups, setStoreGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [birthdayMonth, setBirthdayMonth] = useState<string>("");
  const [birthdayDay, setBirthdayDay] = useState<string>("");
  const [startMonth, setStartMonth] = useState<string>("");
  const [startYear, setStartYear] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserGroupId, setCurrentUserGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Update storeId when currentStoreId changes
  useEffect(() => {
    if (currentStoreId) {
      setStoreId(currentStoreId);
    }
  }, [currentStoreId]);

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

  // Load stores and store groups when dialog opens
  useEffect(() => {
    if (open) {
      loadStores();
      loadStoreGroups();
      if (currentStoreId) {
        loadDepartments(currentStoreId);
      }
    }
  }, [open, currentStoreId, isSuperAdmin, currentUserGroupId]);

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("name");
    
    if (error) {
      console.error("Error fetching stores:", error);
      toast({
        title: "Error",
        description: "Failed to load stores. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    if (data) {
      // Filter out stores with empty or null IDs
      setStores(data.filter(s => s.id && s.id.trim() !== ""));
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
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching store groups:", error);
      toast({
        title: "Error",
        description: "Failed to load store groups. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    if (data) {
      // Filter out store groups with empty or null IDs
      setStoreGroups(data.filter(g => g.id && g.id.trim() !== ""));
    }
  };

  const loadDepartments = async (storeId: string) => {
    const { data, error } = await supabase
      .from("departments")
      .select("*, department_types(name)")
      .eq("store_id", storeId);
    
    if (!error && data) {
      setDepartments(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();
      
      if (checkError) {
        console.error("Error checking email:", checkError);
      } else if (existingUser) {
        toast({
          title: "Email Already Exists",
          description: `A user named "${existingUser.full_name}" already has this email address. Please use a different email or manage the existing user from the Users dialog.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          full_name: fullName,
          role,
          store_id: storeId || null,
          store_group_id: storeGroupId || null,
          department_id: departmentId || null,
          birthday_month: birthdayMonth ? parseInt(birthdayMonth) : null,
          birthday_day: birthdayDay ? parseInt(birthdayDay) : null,
          start_month: startMonth ? parseInt(startMonth) : null,
          start_year: startYear ? parseInt(startYear) : null,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast({
        title: "Success",
        description: `User created successfully. An invitation email has been sent to ${email} to set their password.`,
      });

      // Reset form
      setEmail("");
      setFullName("");
      setRole("department_manager");
      setStoreId(currentStoreId || "");
      setStoreGroupId("");
      setDepartmentId("");
      setBirthdayMonth("");
      setBirthdayDay("");
      setStartMonth("");
      setStartYear("");
      
      onUserCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Provide specific error messages for common cases
      let errorMessage = "Failed to create user";
      
      if (error.message?.includes("already been registered") || error.message?.includes("email_exists")) {
        errorMessage = `A user with email "${email}" already exists in the system. Please use the Users dialog to manage existing users or choose a different email address.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. They will receive an email to set their password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com (optional - will auto-generate if empty)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Only super admins can create other super admins */}
                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                <SelectItem value="store_gm">Store GM</SelectItem>
                <SelectItem value="department_manager">Department Manager</SelectItem>
                <SelectItem value="read_only">Read Only</SelectItem>
                {departments.some(d => d.department_types?.name?.toLowerCase().includes('service')) && (
                  <>
                    <SelectItem value="service_advisor">Service Advisor</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </>
                )}
                {departments.some(d => d.department_types?.name?.toLowerCase().includes('parts')) && (
                  <SelectItem value="parts_advisor">Parts Advisor</SelectItem>
                )}
                {departments.some(d => d.department_types?.name?.toLowerCase().includes('sales')) && (
                  <SelectItem value="sales_advisor">Sales Advisor</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {role === "department_manager" && departments.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="department">Assign to Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId} required>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This user will be assigned as the manager of the selected department
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="accessType">Store Access</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store" className="text-xs text-muted-foreground">Single Store</Label>
                <Select value={storeId || "none"} onValueChange={(value) => {
                  setStoreId(value === "none" ? "" : value);
                  if (value !== "none") {
                    setStoreGroupId(""); // Clear group if store selected
                    loadDepartments(value); // Load departments for the selected store
                  } else {
                    setDepartments([]); // Clear departments if no store selected
                  }
                }}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Only show store group selection if super admin */}
              {isSuperAdmin && (
                <div>
                  <Label htmlFor="storeGroup" className="text-xs text-muted-foreground">Store Group (Multi-Store)</Label>
                  <Select value={storeGroupId || "none"} onValueChange={(value) => {
                    setStoreGroupId(value === "none" ? "" : value);
                    if (value !== "none") setStoreId(""); // Clear store if group selected
                  }}>
                    <SelectTrigger id="storeGroup">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {storeGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin 
                ? "Assign to either a single store OR a store group for multi-store access"
                : "Assign to a store within your group"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birthday (Optional)</Label>
              <div className="flex gap-2">
                <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Day"
                  min="1"
                  max="31"
                  value={birthdayDay}
                  onChange={(e) => setBirthdayDay(e.target.value)}
                  className="w-20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Start Date (Optional)</Label>
              <div className="flex gap-2">
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Year"
                  min="1950"
                  max={new Date().getFullYear()}
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
