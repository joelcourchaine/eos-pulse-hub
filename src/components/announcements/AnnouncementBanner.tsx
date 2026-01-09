import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";

type AnnouncementPriority = 'info' | 'warning' | 'urgent';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  starts_at: string;
  expires_at: string;
  store_group_id: string | null;
}

const priorityStyles: Record<AnnouncementPriority, string> = {
  info: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  urgent: "bg-destructive text-destructive-foreground",
};

export const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchAnnouncements = async () => {
      // Fetch active announcements that the user can see (RLS handles store group filtering)
      const { data: announcementsData, error: announcementsError } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .gte("expires_at", new Date().toISOString())
        .order("priority", { ascending: false });

      if (announcementsError) {
        console.error("Error fetching announcements:", announcementsError);
        return;
      }

      // Fetch user's dismissed announcements
      const { data: dismissalsData, error: dismissalsError } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", userId);

      if (dismissalsError) {
        console.error("Error fetching dismissals:", dismissalsError);
      }

      const dismissed = new Set(dismissalsData?.map(d => d.announcement_id) || []);
      setDismissedIds(dismissed);

      // Filter out dismissed announcements and cast priority
      const activeAnnouncements = (announcementsData || [])
        .filter(a => !dismissed.has(a.id))
        .map(a => ({
          ...a,
          priority: a.priority as AnnouncementPriority
        }));

      setAnnouncements(activeAnnouncements);
    };

    fetchAnnouncements();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleDismiss = async (announcementId: string) => {
    if (!userId) return;

    // Optimistically update UI
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    setDismissedIds(prev => new Set([...prev, announcementId]));

    // Persist dismissal to database
    const { error } = await supabase
      .from("announcement_dismissals")
      .insert({
        announcement_id: announcementId,
        user_id: userId
      });

    if (error) {
      console.error("Error dismissing announcement:", error);
      // Revert on error
      setDismissedIds(prev => {
        const next = new Set(prev);
        next.delete(announcementId);
        return next;
      });
    }
  };

  // Configure DOMPurify to only allow specific tags
  const sanitizeConfig = {
    ALLOWED_TAGS: ['a', 'strong', 'em', 'b', 'i', 'u', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  };

  if (announcements.length === 0) return null;

  // Show only the highest priority announcement
  const announcement = announcements[0];

  return (
    <>
      {/* Spacer to push content down */}
      <div className="h-10" />
      {/* Fixed banner */}
      <div 
        className={`fixed top-0 inset-x-0 w-full z-[9999] ${priorityStyles[announcement.priority]} py-2 px-4 flex items-center justify-between overflow-hidden h-10`}
      >
        <div className="flex-1 overflow-hidden relative">
          <div 
            className="whitespace-nowrap animate-marquee inline-block"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(announcement.message, sanitizeConfig)
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-4 shrink-0 h-6 w-6 p-0 hover:bg-white/20"
          onClick={() => handleDismiss(announcement.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </>
  );
};
