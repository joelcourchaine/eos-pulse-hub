import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Enterprise from "./pages/Enterprise";
import DealerComparison from "./pages/DealerComparison";
import FixedCombinedTrendReport from "./pages/FixedCombinedTrendReport";
import ResetPassword from "./pages/ResetPassword";
import SetPassword from "./pages/SetPassword";
import Questionnaire from "./pages/Questionnaire";
import MyTasks from "./pages/MyTasks";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/dealer-comparison" element={<DealerComparison />} />
          <Route path="/fixed-combined-trend" element={<FixedCombinedTrendReport />} />
          <Route path="/questionnaire/:token" element={<Questionnaire />} />
          <Route path="/install" element={<Install />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
