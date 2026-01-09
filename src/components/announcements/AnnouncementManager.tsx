import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Megaphone } from "lucide-react";
import { format, parseISO } from "date-fns";

type AnnouncementPriority = 'info' | 'warning' | 'urgent';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  is_active: boolean;
  store_group_id: string | null;
  starts_at: string;
  expires_at: string;
  created_at: string;
  created_by: string;
}

interface StoreGroup {
  id: string;
  name: string;
}

const priorityColors: Record<AnnouncementPriority, string> = {
  info: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  urgent: "bg-destructive text-destructive-foreground",
};

export const AnnouncementManager = () => {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("info");
  const [isActive, setIsActive] = useState(true);
  const [storeGroupId, setStoreGroupId] = useState<string>("all");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
    fetchAnnouncements();
    fetchStoreGroups();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching announcements:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load announcements",
      });
    } else {
      setAnnouncements((data || []).map(a => ({
        ...a,
        priority: a.priority as AnnouncementPriority
      })));
    }
    setLoading(false);
  };

  const fetchStoreGroups = async () => {
    const { data, error } = await supabase
      .from("store_groups")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error fetching store groups:", error);
    } else {
      setStoreGroups(data || []);
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setPriority("info");
    setIsActive(true);
    setStoreGroupId("all");
    setStartsAt("");
    setExpiresAt("");
    setEditingAnnouncement(null);
  };

  const openCreateDialog = () => {
    resetForm();
    // Set default dates
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setStartsAt(format(now, "yyyy-MM-dd'T'HH:mm"));
    setExpiresAt(format(nextWeek, "yyyy-MM-dd'T'HH:mm"));
    setDialogOpen(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setPriority(announcement.priority);
    setIsActive(announcement.is_active);
    setStoreGroupId(announcement.store_group_id || "all");
    setStartsAt(format(parseISO(announcement.starts_at), "yyyy-MM-dd'T'HH:mm"));
    setExpiresAt(format(parseISO(announcement.expires_at), "yyyy-MM-dd'T'HH:mm"));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to create announcements",
      });
      return;
    }

    if (!title.trim() || !message.trim() || !startsAt || !expiresAt) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    const announcementData = {
      title: title.trim(),
      message: message.trim(),
      priority,
      is_active: isActive,
      store_group_id: storeGroupId === "all" ? null : storeGroupId,
      starts_at: new Date(startsAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      created_by: userId,
    };

    let error;
    if (editingAnnouncement) {
      const { error: updateError } = await supabase
        .from("announcements")
        .update(announcementData)
        .eq("id", editingAnnouncement.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("announcements")
        .insert(announcementData);
      error = insertError;
    }

    if (error) {
      console.error("Error saving announcement:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save announcement",
      });
    } else {
      toast({
        title: "Success",
        description: editingAnnouncement ? "Announcement updated" : "Announcement created",
      });
      setDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting announcement:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete announcement",
      });
    } else {
      toast({
        title: "Success",
        description: "Announcement deleted",
      });
      fetchAnnouncements();
    }
  };

  const getStoreGroupName = (id: string | null) => {
    if (!id) return "All Groups";
    const group = storeGroups.find(g => g.id === id);
    return group?.name || "Unknown";
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const isUpcoming = (startsAt: string) => new Date(startsAt) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Announcements</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title (Admin Reference)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q1 Goals Reminder"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Supports HTML links)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., Don't forget to complete your monthly scorecard!"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Use HTML for links: {"<a href=\"URL\">Link text</a>"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Amber)</SelectItem>
                    <SelectItem value="urgent">Urgent (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Automotive Group</Label>
                <Select value={storeGroupId} onValueChange={setStoreGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {storeGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Starts At</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingAnnouncement ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No announcements yet. Create your first one!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className={isExpired(announcement.expires_at) ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {announcement.title}
                      <Badge className={priorityColors[announcement.priority]}>
                        {announcement.priority}
                      </Badge>
                      {!announcement.is_active && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                      {isExpired(announcement.expires_at) && (
                        <Badge variant="secondary">Expired</Badge>
                      )}
                      {isUpcoming(announcement.starts_at) && (
                        <Badge variant="secondary">Scheduled</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Target: {getStoreGroupName(announcement.store_group_id)} • 
                      {format(parseISO(announcement.starts_at), " MMM d, yyyy h:mm a")} - 
                      {format(parseISO(announcement.expires_at), " MMM d, yyyy h:mm a")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(announcement)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-sm bg-muted p-3 rounded-md"
                  dangerouslySetInnerHTML={{ __html: announcement.message }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
