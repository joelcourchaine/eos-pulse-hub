import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { RoutineSidebar } from "@/components/routines";
import { Button } from "@/components/ui/button";
import { Users, LogOut, Loader2 } from "lucide-react";
import { ReverseOrgChart, type TeamMember } from "@/components/team/ReverseOrgChart";
import { AddTeamMemberDialog } from "@/components/team/AddTeamMemberDialog";
import { TeamMemberDetailPanel } from "@/components/team/TeamMemberDetailPanel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AdminNavDropdown } from "@/components/navigation/AdminNavDropdown";
import { useUserRole } from "@/hooks/use-user-role";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import goLogo from "@/assets/go-logo.png";

const MyTeam = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarDeptId, setSidebarDeptId] = useState<string>("");
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const { isSuperAdmin, isStoreGM, isDepartmentManager, isFixedOpsManager, loading: rolesLoading } = useUserRole(user?.id);
  const canManage = isSuperAdmin || isStoreGM || isDepartmentManager || isFixedOpsManager;

  // The effective store: profile's store or super_admin's selected store
  const effectiveStoreId = profile?.store_id || selectedStoreId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      fetchProfile(session.user.id);
    });
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    setLoading(false);
  };

  // Fetch stores list for super_admins without a store_id
  useEffect(() => {
    if (isSuperAdmin && !profile?.store_id) {
      supabase.from("stores").select("id, name").order("name").then(({ data }) => {
        if (data) {
          setStores(data);
          if (data.length > 0 && !selectedStoreId) setSelectedStoreId(data[0].id);
        }
      });
    }
  }, [isSuperAdmin, profile?.store_id]);

  useEffect(() => {
    if (effectiveStoreId) {
      fetchMembers();
      supabase
        .from("departments")
        .select("id")
        .eq("store_id", effectiveStoreId)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) setSidebarDeptId(data[0].id);
        });
    }
  }, [effectiveStoreId]);

  // Realtime subscription
  useEffect(() => {
    if (!effectiveStoreId) return;
    const channel = supabase
      .channel("team-members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        fetchMembers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveStoreId]);

  const fetchMembers = async () => {
    if (!effectiveStoreId) return;
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("store_id", effectiveStoreId)
      .order("created_at");
    if (!error && data) setMembers(data as TeamMember[]);
  };

  const handleSelectMember = (member: TeamMember) => {
    setSelectedMember(member);
    setDetailOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="border-b bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <img src={goLogo} alt="Logo" className="h-8 w-8 object-contain cursor-pointer" onClick={() => navigate("/dashboard")} />
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold">My Team</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSuperAdmin && !profile?.store_id && stores.length > 0 && (
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {canManage && effectiveStoreId && (
                  <AddTeamMemberDialog storeId={effectiveStoreId} existingMembers={members} onAdded={fetchMembers} />
                )}
                <AdminNavDropdown />
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-4 md:p-6">
            <ReverseOrgChart members={members} onSelectMember={handleSelectMember} />
          </main>

          {/* Detail Panel */}
          <TeamMemberDetailPanel
            member={selectedMember}
            allMembers={members}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            onUpdated={fetchMembers}
          />
        </SidebarInset>

        {sidebarDeptId && user && (
          <RoutineSidebar departmentId={sidebarDeptId} userId={user.id} />
        )}
      </div>
    </SidebarProvider>
  );
};

export default MyTeam;
