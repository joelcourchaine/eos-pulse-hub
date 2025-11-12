import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, Users, TrendingUp } from "lucide-react";
import goLogo from "@/assets/go-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <img src={goLogo} alt="GO Logo" className="h-20 w-20 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-foreground mb-4">
            GO Scorecard Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your dealership performance with data-driven accountability.
            Track KPIs, manage quarterly rocks, and run effective GO meetings—all in one place.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Weekly Scorecards</h3>
            <p className="text-muted-foreground">
              Track department KPIs with auto-calculated variances and color-coded status indicators.
              Weekly data rolls up to monthly, quarterly, and yearly views.
            </p>
          </div>

          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Rocks & Priorities</h3>
            <p className="text-muted-foreground">
              Manage 3-5 quarterly rocks per department with progress tracking, status updates,
              and accountability assignments.
            </p>
          </div>

          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-2">GO Meeting Flow</h3>
            <p className="text-muted-foreground">
              Built-in 60-minute meeting framework with segue, scorecard review, rocks,
              headlines, to-dos, and IDS (Identify, Discuss, Solve).
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Replace Your Spreadsheets?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join dealership groups using our platform to drive accountability and performance.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate("/auth")}
          >
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
