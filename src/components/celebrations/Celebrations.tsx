import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Cake, Award, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  birthday_month: number | null;
  birthday_day: number | null;
  start_month: number | null;
  start_year: number | null;
}

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
    let query = supabase
      .from("profiles")
      .select("id, full_name, birthday_month, birthday_day, start_month, start_year");

    // Filter by current store if provided
    if (currentStoreId) {
      // Get the store's group_id
      const { data: storeData } = await supabase
        .from("stores")
        .select("group_id")
        .eq("id", currentStoreId)
        .single();
      
      // Show users from this store OR users from this store's group
      if (storeData?.group_id) {
        query = query.or(`store_id.eq.${currentStoreId},store_group_id.eq.${storeData.group_id}`);
      } else {
        query = query.eq("store_id", currentStoreId);
      }
    }
    
    const { data: profiles, error } = await query;

    if (error) {
      console.error("Error loading profiles:", error);
      setLoading(false);
      return;
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const upcomingCelebrations: Celebration[] = [];

    profiles?.forEach((profile: Profile) => {
      // Process birthdays
      if (profile.birthday_month && profile.birthday_day) {
        const birthdayThisYear = new Date(currentYear, profile.birthday_month - 1, profile.birthday_day);
        const birthdayNextYear = new Date(currentYear + 1, profile.birthday_month - 1, profile.birthday_day);
        
        let birthdayDate = birthdayThisYear;
        if (birthdayThisYear < today) {
          birthdayDate = birthdayNextYear;
        }

        const daysUntil = Math.ceil((birthdayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 30) {
          upcomingCelebrations.push({
            id: profile.id,
            name: profile.full_name,
            type: "birthday",
            date: birthdayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
            daysUntil,
          });
        }
      }

      // Process work anniversaries
      if (profile.start_month && profile.start_year) {
        const anniversaryThisYear = new Date(currentYear, profile.start_month - 1, 1);
        const anniversaryNextYear = new Date(currentYear + 1, profile.start_month - 1, 1);
        
        let anniversaryDate = anniversaryThisYear;
        if (anniversaryThisYear < today) {
          anniversaryDate = anniversaryNextYear;
        }

        const yearsOfService = anniversaryDate.getFullYear() - profile.start_year;
        const daysUntil = Math.ceil((anniversaryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 30 && yearsOfService > 0) {
          upcomingCelebrations.push({
            id: `${profile.id}-anniversary`,
            name: profile.full_name,
            type: "anniversary",
            date: anniversaryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            daysUntil,
            yearsOfService,
          });
        }
      }
    });

    // Sort by days until celebration
    upcomingCelebrations.sort((a, b) => a.daysUntil - b.daysUntil);

    setCelebrations(upcomingCelebrations);
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
          <CardDescription>
            Upcoming birthdays and work anniversaries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No celebrations in the next 30 days
          </p>
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
        <CardDescription>
          Upcoming birthdays and work anniversaries in the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {celebrations.map((celebration) => (
            <div
              key={celebration.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                celebration.type === "birthday" ? "bg-pink-100 dark:bg-pink-900/30" : "bg-blue-100 dark:bg-blue-900/30"
              }`}>
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
                      {celebration.yearsOfService} year{celebration.yearsOfService !== 1 ? "s" : ""} anniversary in {celebration.date}
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-primary">
                  {celebration.daysUntil === 0 ? "Today!" : celebration.daysUntil === 1 ? "Tomorrow" : `In ${celebration.daysUntil} days`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
