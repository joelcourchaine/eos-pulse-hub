import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ticketSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  description: z.string().min(10, "Please provide more detail").max(5000, "Description too long"),
  priority: z.enum(["low", "normal", "urgent"]),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface HelpTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: "bug_report" | "feature_request" | "question" | "other";
  errorContext?: {
    message?: string;
    stack?: string;
  };
}

const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  const browserMatch = ua.match(/(chrome|safari|firefox|opera|edge|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  const browser = browserMatch[1] || "Unknown";
  const version = browserMatch[2] || "";
  const os = ua.includes("Windows") ? "Windows" : 
             ua.includes("Mac") ? "macOS" : 
             ua.includes("Linux") ? "Linux" : 
             ua.includes("Android") ? "Android" : 
             ua.includes("iOS") ? "iOS" : "Unknown";
  return `${browser} ${version} on ${os}`;
};

export const HelpTicketDialog = ({
  open,
  onOpenChange,
  defaultCategory = "bug_report",
  errorContext,
}: HelpTicketDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: errorContext?.message ? `Error: ${errorContext.message.slice(0, 100)}` : "",
      description: "",
      priority: "normal",
    },
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserInfo({ name: profile.full_name, email: profile.email });
        }
      }
    };
    
    if (open) {
      fetchUserInfo();
    }
  }, [open]);

  // Reset form when dialog opens with error context
  useEffect(() => {
    if (open && errorContext?.message) {
      form.reset({
        subject: `Error: ${errorContext.message.slice(0, 100)}`,
        description: "",
        priority: "normal",
      });
      setShowDetails(true);
    }
  }, [open, errorContext, form]);

  const handleScreenshotChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setScreenshot(file);
    }
  }, []);

  const onSubmit = async (values: TicketFormValues) => {
    if (!userInfo) return;
    
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let screenshotPath: string | null = null;

      // Upload screenshot if provided
      if (screenshot) {
        const fileExt = screenshot.name.split(".").pop();
        const fileName = `tickets/${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("note-attachments")
          .upload(fileName, screenshot);
        
        if (uploadError) throw uploadError;
        screenshotPath = fileName;
      }

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("help_tickets")
        .insert({
          user_id: user.id,
          user_name: userInfo.name,
          user_email: userInfo.email,
          page_url: window.location.pathname,
          browser_info: getBrowserInfo(),
          error_message: errorContext?.message || null,
          error_stack: errorContext?.stack || null,
          subject: values.subject,
          description: values.description,
          category: defaultCategory,
          priority: values.priority,
          screenshot_path: screenshotPath,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Send notification email
      await supabase.functions.invoke("send-ticket-notification", {
        body: { ticketId: ticket.id },
      });

      toast({
        title: "Ticket submitted",
        description: `Your ticket #${ticket.ticket_number} has been created. We'll get back to you soon.`,
      });

      form.reset();
      setScreenshot(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting ticket:", error);
      toast({
        title: "Error submitting ticket",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {defaultCategory === "feature_request" ? "Request a Feature" : "Report an Issue"}
          </SheetTitle>
          <SheetDescription>
            {defaultCategory === "feature_request" 
              ? "Tell us about a feature you'd like to see"
              : "Let us know what went wrong and we'll look into it"
            }
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            {/* Auto-captured info (collapsible) */}
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="text-muted-foreground text-xs">
                    {userInfo?.name} • {window.location.pathname}
                  </span>
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 bg-muted rounded-md text-xs space-y-1">
                <p><strong>User:</strong> {userInfo?.name} ({userInfo?.email})</p>
                <p><strong>Page:</strong> {window.location.pathname}</p>
                <p><strong>Browser:</strong> {getBrowserInfo()}</p>
                <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
                {errorContext?.message && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                    <p className="font-semibold text-destructive">Error Message:</p>
                    <p className="break-all">{errorContext.message}</p>
                    {errorContext.stack && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-destructive/70">Stack trace</summary>
                        <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">{errorContext.stack}</pre>
                      </details>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief summary of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe what happened, what you expected, and steps to reproduce..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="low" id="low" />
                        <Label htmlFor="low">Low</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="normal" id="normal" />
                        <Label htmlFor="normal">Normal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="urgent" id="urgent" />
                        <Label htmlFor="urgent">Urgent</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Screenshot upload */}
            <div className="space-y-2">
              <Label>Screenshot (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="hidden"
                  id="screenshot-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("screenshot-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Screenshot
                </Button>
                {screenshot && (
                  <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {screenshot.name}
                  </span>
                )}
              </div>
            </div>

            <SheetFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Ticket"
                )}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};
