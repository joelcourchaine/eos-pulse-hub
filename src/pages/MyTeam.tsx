import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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
  
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const [searchParams] = useSearchParams();
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
          const paramStore = searchParams.get("store");
          const preferred = paramStore && data.find(s => s.id === paramStore) ? paramStore : (data.length > 0 ? data[0].id : "");
          if (!selectedStoreId) setSelectedStoreId(preferred);
        }
      });
    }
  }, [isSuperAdmin, profile?.store_id]);

  useEffect(() => {
    if (effectiveStoreId) {
      fetchMembers();
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

          {/* Bottom Stats Bar */}
          {(() => {
            const POSITION_LABEL: Record<string, string> = {
              service_manager: "Service Manager", assistant_service_manager: "Assistant Service Manager",
              foreman: "Shop Foreman", dispatcher: "Dispatcher", advisor: "Advisor",
              express_advisor: "Express / Quick Lane Advisor", junior_advisor: "Junior Advisor",
              internal_advisor: "Internal Advisor", technician: "Technician",
              lube_technician: "Lube Technician", apprentice_1: "1st Year Apprentice",
              apprentice_2: "2nd Year Apprentice", apprentice_3: "3rd Year Apprentice",
              apprentice_4: "4th Year Apprentice", red_seal_technician: "Red Seal Technician",
              porter: "Porter", shuttle_driver: "Shuttle Driver", warranty_admin: "Warranty Admin",
              detailer: "Detailer", administrative: "Administrative", cashier: "Cashier",
              detail_manager: "Detail Manager", appointment_coordinator: "Appointment Coordinator",
            };
            const total = members.filter(m => m.name && m.name !== "Vacant" && (m as any).status !== "vacant").length;
            const vacantMembers = members.filter(m => !m.name || m.name === "Vacant" || (m as any).status === "vacant");
            const vacantPositions = [...new Set(vacantMembers.map(m => POSITION_LABEL[m.position] || m.position))];
            if (total === 0 && vacantMembers.length === 0) return null;
            return (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-stretch bg-card/90 backdrop-blur border rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="px-8 py-4 text-center">
                  <div className="text-5xl font-bold tabular-nums">{total}</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">Team Members</div>
                </div>
                {vacantMembers.length > 0 && (
                  <>
                    <div className="w-px bg-border my-3" />
                    <div className="px-8 py-4">
                      <div className="text-5xl font-bold tabular-nums text-amber-500">{vacantMembers.length}</div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">Vacant</div>
                      {vacantPositions.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {vacantPositions.map(p => (
                            <li key={p} className="text-xs italic text-amber-500/80">{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Detail Panel */}
          <TeamMemberDetailPanel
            member={selectedMember}
            allMembers={members}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            onUpdated={fetchMembers}
          />
        </SidebarInset>

      </div>
    </SidebarProvider>
  );
};

export default MyTeam;
