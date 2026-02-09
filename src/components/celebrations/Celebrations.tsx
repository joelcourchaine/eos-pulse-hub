import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Cake, Award, Loader2 } from "lucide-react";

interface Celebration {
  id: string;
  name: string;
  type: "birthday" | "anniversary";
  date: string;
  daysUntil: number;
  yearsOfService?: number;
}

interface CelebrationsProps {
  currentStoreId?: string | null;
}

export const Celebrations = ({ currentStoreId }: CelebrationsProps) => {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCelebrations();
  }, [currentStoreId]);

  const loadCelebrations = async () => {
    const { data, error } = await (supabase.rpc as any)("get_upcoming_celebrations", {
      p_store_id: currentStoreId || null,
      p_days_ahead: 30,
    });

    if (error) {
      console.error("Error loading celebrations:", error);
      setLoading(false);
      return;
    }

    const mapped: Celebration[] = (data || []).map((row: any) => ({
      id: row.celebration_type === "anniversary" ? `${row.profile_id}-anniversary` : row.profile_id,
      name: row.full_name,
      type: row.celebration_type as "birthday" | "anniversary",
      date: row.celebration_date?.trim() ?? "",
      daysUntil: row.days_until,
      yearsOfService: row.years_of_service ?? undefined,
    }));

    setCelebrations(mapped);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5" />
            Celebrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (celebrations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5" />
            Celebrations
          </CardTitle>
          <CardDescription>Upcoming birthdays and work anniversaries</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No recent or upcoming celebrations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="h-5 w-5" />
          Celebrations
        </CardTitle>
        <CardDescription>Recent and upcoming birthdays and work anniversaries</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {celebrations.map((celebration) => (
            <div
              key={celebration.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  celebration.type === "birthday"
                    ? "bg-pink-100 dark:bg-pink-900/30"
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}
              >
                {celebration.type === "birthday" ? (
                  <Cake className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                ) : (
                  <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{celebration.name}</p>
                <p className="text-xs text-muted-foreground">
                  {celebration.type === "birthday" ? (
                    <>Birthday on {celebration.date}</>
                  ) : (
                    <>
                      {celebration.yearsOfService} year{celebration.yearsOfService !== 1 ? "s" : ""} anniversary in{" "}
                      {celebration.date}
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-primary">
                  {celebration.daysUntil === 0
                    ? "Today!"
                    : celebration.daysUntil === 1
                      ? "Tomorrow"
                      : celebration.daysUntil > 0
                        ? `In ${celebration.daysUntil} days`
                        : celebration.daysUntil === -1
                          ? "Yesterday"
                          : `${Math.abs(celebration.daysUntil)} days ago`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
