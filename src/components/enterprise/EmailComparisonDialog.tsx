import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2, FileSpreadsheet } from "lucide-react";

interface Recipient {
  id: string;
  email: string;
  full_name: string;
  role: string;
  store_name?: string;
}

interface StoreInfo {
  storeId: string;
  storeName: string;
  departmentName?: string;
  monthsWithData: string[];
  lastCompleteMonth: string | null;
  isComplete: boolean;
}

interface ComparisonMetric {
  metricName: string;
  displayName?: string;
  isPercentage?: boolean;
  lowerIsBetter?: boolean;
  storeValues: Record<string, { value: number | null; target: number | null; variance: number | null }>;
}

interface QuestionnaireAnswer {
  storeName: string;
  departmentName: string;
  questionText: string;
  answerValue: string | null;
}

interface EmailComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeIds: string[];
  stores: StoreInfo[];
  metrics: ComparisonMetric[];
  questionnaireData?: QuestionnaireAnswer[];
  metricType?: string;
  selectedMetrics: string[];
  datePeriodType: string;
  selectedMonth?: string;
  selectedYear?: number;
  startMonth?: string;
  endMonth?: string;
  comparisonMode: string;
  filterName?: string;
  brandDisplayName?: string;
  selectedDepartmentNames?: string[];
  isYoyMonth?: boolean;
  yoyCurrentYear?: number;
  yoyPrevYear?: number | string;
  rowNotes?: Record<string, string>;
}

export function EmailComparisonDialog({
  open,
  onOpenChange,
  storeIds,
  stores,
  metrics,
  questionnaireData,
  metricType,
  selectedMetrics,
  datePeriodType,
  selectedMonth,
  selectedYear,
  startMonth,
  endMonth,
  comparisonMode,
  filterName,
  brandDisplayName,
  selectedDepartmentNames,
  isYoyMonth,
  yoyCurrentYear,
  yoyPrevYear,
  rowNotes,
}: EmailComparisonDialogProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachExcel, setAttachExcel] = useState(true);

  useEffect(() => {
    if (open && storeIds.length > 0) {
      fetchRecipients();
    }
  }, [open, storeIds]);

  const fetchRecipients = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Fetch super_admins
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];

      // Fetch store_gm roles
      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");

      const gmUserIds = gmRoles?.map(r => r.user_id) || [];

      // Fetch profiles for super admins
      const { data: superAdminProfiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", superAdminIds);

      // Fetch profiles for GMs that belong to the selected stores
      const { data: gmProfiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, store_id, stores(name)")
        .in("id", gmUserIds)
        .in("store_id", storeIds);

      const recipientList: Recipient[] = [];

      // Add super admins
      superAdminProfiles?.forEach(p => {
        recipientList.push({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: currentUser?.id === p.id ? "Super Admin (You)" : "Super Admin",
          store_name: "All Stores",
        });
      });

      // Add GMs
      gmProfiles?.forEach(p => {
        // Skip if already added as super admin
        if (!recipientList.find(r => r.id === p.id)) {
          recipientList.push({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            role: currentUser?.id === p.id ? "General Manager (You)" : "General Manager",
            store_name: (p.stores as any)?.name || "Unknown Store",
          });
        }
      });

      // Add current user if not already in the list
      if (currentUser && !recipientList.find(r => r.id === currentUser.id)) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("id, email, full_name, stores(name)")
          .eq("id", currentUser.id)
          .single();

        if (currentProfile) {
          recipientList.unshift({
            id: currentProfile.id,
            email: currentProfile.email,
            full_name: currentProfile.full_name,
            role: "You",
            store_name: (currentProfile.stores as any)?.name || undefined,
          });
        }
      }

      setRecipients(recipientList);
      // Default to no recipients selected
      setSelectedRecipients([]);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      toast.error("Failed to load recipients");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const toggleAll = () => {
    if (selectedRecipients.length === recipients.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map(r => r.email));
    }
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-dealer-comparison-email", {
        body: {
          recipientEmails: selectedRecipients,
          stores,
          metrics,
          questionnaireData,
          metricType,
          selectedMetrics,
          datePeriodType,
          selectedMonth,
          selectedYear,
          startMonth,
          endMonth,
          comparisonMode,
          filterName,
          brandDisplayName,
          selectedDepartmentNames,
          isYoyMonth: isYoyMonth || false,
          yoyCurrentYear,
          yoyPrevYear,
          attachExcel,
          rowNotes,
        },
      });

      if (error) throw error;

      toast.success(`Report sent to ${selectedRecipients.length} recipient(s)`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Comparison Report
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select recipients to receive this dealer comparison report.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No eligible recipients found.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <Label className="text-sm font-medium">Recipients</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedRecipients.length === recipients.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {recipients.map(recipient => (
                  <div
                    key={recipient.id}
                    className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      id={recipient.id}
                      checked={selectedRecipients.includes(recipient.email)}
                      onCheckedChange={() => toggleRecipient(recipient.email)}
                    />
                    <label
                      htmlFor={recipient.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="text-sm font-medium">{recipient.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {recipient.role} • {recipient.store_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{recipient.email}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="attach-excel" className="text-sm cursor-pointer">
                Attach Excel report
              </Label>
            </div>
            <Switch
              id="attach-excel"
              checked={attachExcel}
              onCheckedChange={setAttachExcel}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || selectedRecipients.length === 0}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send to {selectedRecipients.length} recipient(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
