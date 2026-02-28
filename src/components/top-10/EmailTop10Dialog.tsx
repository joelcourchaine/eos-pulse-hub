import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { z } from "zod";

interface Recipient {
  id: string;
  email: string;
  full_name: string;
  role: string;
  store_name?: string;
}

interface EmailTop10DialogProps {
  listId: string;
  listTitle: string;
  departmentId: string;
}

export function EmailTop10Dialog({
  listId,
  listTitle,
  departmentId,
}: EmailTop10DialogProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState("");

  const { validEmails: validatedCustomEmails, invalidEntries } = useMemo(() => {
    if (!customEmailInput.trim())
      return { validEmails: [] as string[], invalidEntries: [] as string[] };
    const parts = customEmailInput
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    parts.forEach((part) => {
      if (z.string().email().safeParse(part).success) {
        if (!selectedRecipients.includes(part) && !valid.includes(part)) {
          valid.push(part);
        }
      } else {
        invalid.push(part);
      }
    });
    return { validEmails: valid, invalidEntries: invalid };
  }, [customEmailInput, selectedRecipients]);

  const totalRecipientCount =
    selectedRecipients.length + validatedCustomEmails.length;

  useEffect(() => {
    if (open && departmentId) {
      fetchRecipients();
    }
  }, [open, departmentId]);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // Get department's store_id
      const { data: dept } = await supabase
        .from("departments")
        .select("store_id")
        .eq("id", departmentId)
        .single();

      const storeId = dept?.store_id;

      // Fetch super admins
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = superAdminRoles?.map((r) => r.user_id) || [];

      // Fetch GM roles
      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");
      const gmUserIds = gmRoles?.map((r) => r.user_id) || [];

      const { data: superAdminProfiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", superAdminIds);

      let gmProfiles: any[] = [];
      if (storeId) {
        const { data } = await supabase
          .from("profiles")
          .select("id, email, full_name, store_id, stores(name)")
          .in("id", gmUserIds)
          .eq("store_id", storeId);
        gmProfiles = data || [];
      }

      const recipientList: Recipient[] = [];

      superAdminProfiles?.forEach((p) => {
        recipientList.push({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role:
            currentUser?.id === p.id ? "Super Admin (You)" : "Super Admin",
          store_name: "All Stores",
        });
      });

      gmProfiles.forEach((p: any) => {
        if (!recipientList.find((r) => r.id === p.id)) {
          recipientList.push({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            role: "Store GM",
            store_name: (p.stores as any)?.name || "",
          });
        }
      });

      setRecipients(recipientList);
      // Auto-select current user if present
      if (currentUser) {
        const me = recipientList.find((r) => r.id === currentUser.id);
        if (me) setSelectedRecipients([me.email]);
      }
    } catch (error) {
      console.error("Error fetching recipients:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (email: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  const toggleAll = () => {
    if (selectedRecipients.length === recipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map((r) => r.email));
    }
  };

  const handleSend = async () => {
    if (totalRecipientCount === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    const allRecipients = [...selectedRecipients, ...validatedCustomEmails];
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-top10-email",
        {
          body: { listId, recipientEmails: allRecipients },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Email sent to ${allRecipients.length} recipient${allRecipients.length > 1 ? "s" : ""}`
      );
      setOpen(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        title="Email this list"
      >
        <Mail className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Email Top 10 List</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{listTitle}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Recipient list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Recipients</span>
                {recipients.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={toggleAll}
                  >
                    {selectedRecipients.length === recipients.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recipients...
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Checkbox
                        id={recipient.id}
                        checked={selectedRecipients.includes(recipient.email)}
                        onCheckedChange={() =>
                          toggleRecipient(recipient.email)
                        }
                      />
                      <label
                        htmlFor={recipient.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <div className="font-medium">
                          {recipient.full_name}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {recipient.role}
                            {recipient.store_name
                              ? ` · ${recipient.store_name}`
                              : ""}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {recipient.email}
                        </div>
                      </label>
                    </div>
                  ))}
                  {recipients.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No recipients found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Custom emails */}
            <div className="space-y-1">
              <span className="text-sm font-medium">
                Additional emails{" "}
                <span className="font-normal text-muted-foreground">
                  (comma-separated)
                </span>
              </span>
              <Input
                placeholder="email@example.com, another@example.com"
                value={customEmailInput}
                onChange={(e) => setCustomEmailInput(e.target.value)}
              />
              {invalidEntries.length > 0 && (
                <p className="text-xs text-destructive">
                  Invalid: {invalidEntries.join(", ")}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || totalRecipientCount === 0}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                `Send to ${totalRecipientCount} recipient${totalRecipientCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
