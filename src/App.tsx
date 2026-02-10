import React from "react";
import { useAutoRefreshOnReturn } from "@/hooks/useAutoRefreshOnReturn";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ConsultingScheduler from "./pages/ConsultingScheduler";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AnnouncementBanner } from "@/components/announcements/AnnouncementBanner";
import { FloatingSupportButton } from "@/components/support/FloatingSupportButton";
import Index from "./pages/Index";
import MurrayIndex from "./pages/MurrayIndex";
import SMGIndex from "./pages/SMGIndex";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Enterprise from "./pages/Enterprise";
import DealerComparison from "./pages/DealerComparison";
import ResetPassword from "./pages/ResetPassword";
import SetPassword from "./pages/SetPassword";
import Questionnaire from "./pages/Questionnaire";
import MyTasks from "./pages/MyTasks";
import Install from "./pages/Install";
import MandatoryKPIRules from "./pages/MandatoryKPIRules";
import Announcements from "./pages/Announcements";
import Signatures from "./pages/Signatures";
import SignDocument from "./pages/SignDocument";
import SignDocumentByToken from "./pages/SignDocumentByToken";
import AdminTickets from "./pages/AdminTickets";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ScorecardMapperPage from "./pages/ScorecardMapperPage";
import Resources from "./pages/Resources";
import AdminResources from "./pages/AdminResources";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Home route component with hostname detection
const HomeRoute = () => {
  const hostname = window.location.hostname;
  const isMurrayDomain = hostname === "murraygrowth.ca" || hostname === "www.murraygrowth.ca";
  const isSMGDomain = hostname === "smggrowth.ca" || hostname === "www.smggrowth.ca";
  if (isMurrayDomain) return <MurrayIndex />;
  if (isSMGDomain) return <SMGIndex />;
  return <Index />;
};

const App = () => {
  // Auto-refresh when user returns after 2+ hours of inactivity
  useAutoRefreshOnReturn();

  return (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnnouncementBanner />
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-tasks" element={<MyTasks />} />
            <Route path="/enterprise" element={<Enterprise />} />
            <Route path="/dealer-comparison" element={<DealerComparison />} />
            <Route path="/questionnaire/:token" element={<Questionnaire />} />
            <Route path="/sign/t/:token" element={<SignDocumentByToken />} />
            <Route path="/sign/:requestId" element={<SignDocument />} />
            <Route path="/install" element={<Install />} />
            <Route path="/admin/kpi-rules" element={<MandatoryKPIRules />} />
            <Route path="/admin/announcements" element={<Announcements />} />
            <Route path="/admin/signatures" element={<Signatures />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
            <Route path="/admin/scorecard-mapper" element={<ScorecardMapperPage />} />
            <Route path="/admin/consulting" element={<ConsultingScheduler />} />
            <Route path="/admin/resources" element={<AdminResources />} />
            <Route path="/resources" element={<Resources />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingSupportButton />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
