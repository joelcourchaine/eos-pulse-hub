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

  const { isSuperAdmin, isStoreGM, isDepartmentManager, isFixedOpsManager, loading: rolesLoading } = useUserRole(user?.id);
  const canManage = isSuperAdmin || isStoreGM || isDepartmentManager || isFixedOpsManager;

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

  useEffect(() => {
    if (profile?.store_id) {
      fetchMembers();
      supabase
        .from("departments")
        .select("id")
        .eq("store_id", profile.store_id)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) setSidebarDeptId(data[0].id);
        });
    }
  }, [profile?.store_id]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.store_id) return;
    const channel = supabase
      .channel("team-members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => {
        fetchMembers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.store_id]);

  const fetchMembers = async () => {
    if (!profile?.store_id) return;
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("store_id", profile.store_id)
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
                {canManage && profile?.store_id && (
                  <AddTeamMemberDialog storeId={profile.store_id} existingMembers={members} onAdded={fetchMembers} />
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
