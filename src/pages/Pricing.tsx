import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  BarChart3,
  Target,
  Users,
  Calendar,
  DollarSign,
  Shield,
  Gauge,
} from "lucide-react";
import goLogo from "@/assets/go-logo.png";

const features = [
  "Real-time KPI gauges & scorecards",
  "Weekly & monthly performance tracking",
  "GO Meeting framework with timer",
  "Quarterly rocks & accountability",
  "Financial summary with trends",
  "Issues & to-dos management",
  "Team celebrations & milestones",
  "Unlimited users per store",
];

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <img
            src={goLogo}
            alt="GO Logo"
            className="h-16 w-16 mx-auto mb-6 rounded-2xl shadow-lg cursor-pointer"
            onClick={() => navigate("/")}
          />
          <h1 className="text-4xl font-bold text-foreground mb-3">
            <span className="font-black">GO</span> Scorecard Platform
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your dealership performance with data-driven
            accountability. Choose the plan that works for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Monthly Plan */}
          <Card className="relative border-border hover:shadow-lg transition-shadow">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-semibold">Monthly</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-foreground">$599</span>
                <span className="text-muted-foreground text-lg">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                per dealership store
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3 mb-8">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" size="lg" variant="outline">
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Annual Plan */}
          <Card className="relative border-primary shadow-lg ring-2 ring-primary/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Save $1,198/year
              </span>
            </div>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-semibold">Annual</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-foreground">
                  $5,990
                </span>
                <span className="text-muted-foreground text-lg">/year</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                per dealership store &mdash; 2 months free
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3 mb-8">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" size="lg">
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Why GO Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why Dealerships Choose GO
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Gauge className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Live KPI Tracking</h3>
              <p className="text-xs text-muted-foreground">
                Real-time visibility into every department's performance
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Structured Meetings</h3>
              <p className="text-xs text-muted-foreground">
                60-minute GO framework keeps meetings focused
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Goal Accountability</h3>
              <p className="text-xs text-muted-foreground">
                Quarterly rocks with ownership and progress tracking
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Financial Insights</h3>
              <p className="text-xs text-muted-foreground">
                Monthly trends, YoY comparisons, and department profitability
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/auth")}
              className="text-primary font-medium hover:underline"
            >
              Sign In
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Questions? Contact us at{" "}
            <a
              href="mailto:info@dealergrowth.solutions"
              className="text-primary hover:underline"
            >
              info@dealergrowth.solutions
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
