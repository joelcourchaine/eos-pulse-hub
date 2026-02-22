import React, { useState, useEffect } from "react";
import { MessageCircleQuestion, Bug, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HelpTicketDialog } from "./HelpTicketDialog";
import { cn } from "@/lib/utils";

type TicketCategory = "bug_report" | "feature_request";

export const FloatingSupportButton = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory>("bug_report");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isAuthenticated) return null;

  const handleOpenTicket = (category: TicketCategory) => {
    setSelectedCategory(category);
    setDialogOpen(true);
    setIsExpanded(false);
  };

  return (
    <>
      {/*
        Important: keep this widget from blocking clicks on underlying UI.
        The wrapper is click-through; only the actual buttons receive pointer events.
      */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
        {/* Expanded menu */}
        <div
          className={cn(
            "flex flex-col gap-2 transition-all duration-200 ease-out pointer-events-auto",
            isExpanded
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none"
          )}
        >
          <Button
            onClick={() => handleOpenTicket("bug_report")}
            variant="secondary"
            size="sm"
            className="shadow-lg flex items-center gap-2 whitespace-nowrap bg-white/90 text-slate-800 hover:bg-white text-xs px-2"
          >
            <Bug className="h-3.5 w-3.5" />
            Issue
          </Button>
          <Button
            onClick={() => handleOpenTicket("feature_request")}
            variant="secondary"
            size="sm"
            className="shadow-lg flex items-center gap-2 whitespace-nowrap bg-white/90 text-slate-800 hover:bg-white text-xs px-2"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Feature
          </Button>
        </div>

        {/* Main floating button */}
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all duration-200 pointer-events-auto bg-white text-slate-800 hover:bg-white/90",
            isExpanded && "bg-slate-200 text-slate-600 hover:bg-slate-300"
          )}
        >
          {isExpanded ? (
            <X className="h-7 w-7" />
          ) : (
            <MessageCircleQuestion className="h-7 w-7" />
          )}
        </Button>
      </div>

      <HelpTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultCategory={selectedCategory}
      />
    </>
  );
};
