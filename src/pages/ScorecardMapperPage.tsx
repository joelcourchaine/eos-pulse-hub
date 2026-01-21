import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ScorecardVisualMapper } from "@/components/admin/scorecard-mapper";
import { AppErrorBoundary } from "@/components/error-boundary";

const ScorecardMapperPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { isSuperAdmin, loading: roleLoading } = useUserRole(userId);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
      setAuthLoading(false);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!userId) {
        navigate("/auth");
      } else if (!isSuperAdmin) {
        navigate("/dashboard");
      }
    }
  }, [userId, isSuperAdmin, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Visual Scorecard Mapper</h1>
            <p className="text-muted-foreground mt-1">
              Drag and drop Excel reports to visually configure column and user mappings
            </p>
          </div>
        </div>

        <AppErrorBoundary title="Visual Mapper error">
          <ScorecardVisualMapper />
        </AppErrorBoundary>
      </div>
    </div>
  );
};

export default ScorecardMapperPage;
