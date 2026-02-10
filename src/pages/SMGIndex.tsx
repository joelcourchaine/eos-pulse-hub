import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Target,
  Users,
  Mail,
  Gauge,
  Calendar,
  CheckSquare,
  PartyPopper,
  AlertTriangle,
  DollarSign,
  Download,
  X,
} from "lucide-react";
import smgLogo from "@/assets/SMG60/Black-Horizontal-PNG.png";
import smgLogoVertical from "@/assets/SMG60/Black-Vertical-PNG.png";
import smgLogoWhite from "@/assets/SMG60/White-Horizontal-PNG.png";
import featureGauges from "@/assets/feature-gauges.png";
import featureMeeting from "@/assets/feature-meeting.png";
import featureScorecard from "@/assets/feature-scorecard-final.png";
import featureRocks from "@/assets/feature-rocks.png";
import featureCelebrations from "@/assets/feature-celebrations.png";
import featureIssues from "@/assets/feature-issues.png";
import featureFinancial from "@/assets/feature-financial.png";

const SMGIndex = () => {
  const navigate = useNavigate();
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const bannerDismissed = sessionStorage.getItem("installBannerDismissed");

    if (isMobile && !isStandalone && !bannerDismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    sessionStorage.setItem("installBannerDismissed", "true");
    setShowInstallBanner(false);
  };

  const handleRequestAccess = () => {
    window.location.href =
      "mailto:info@dealergrowth.solutions?subject=Steve Marshall Group - Request Access to GO Scorecard Platform&body=Hi, I'm from the Steve Marshall Group and interested in getting access to the GO Scorecard Platform.%0A%0ADealership Name:%0AContact Name:%0APhone:%0A";
  };

  const features = [
    {
      icon: Gauge,
      title: "Real-Time KPI Gauges",
      description:
        "See your department's performance at a glance with color-coded gauges showing On Track, At Risk, and Off Track metrics. Know exactly where you stand before every meeting.",
      image: featureGauges,
      imageAlt: "KPI performance gauges showing on track, at risk, and off track metrics",
    },
    {
      icon: Calendar,
      title: "GO Meeting Framework",
      description:
        "Run structured 60-minute weekly meetings with built-in timer and guided sections: Segue, Scorecard Review, Rock Review, Headlines, Issues & To-Dos, and Conclude. Keep your team aligned and accountable.",
      image: featureMeeting,
      imageAlt: "GO Meeting Framework interface with tabs and timer",
    },
    {
      icon: BarChart3,
      title: "Weekly & Monthly Scorecards",
      description:
        "Track KPIs with auto-calculated variances and color-coded status indicators. Weekly data rolls up to monthly, quarterly, and yearly views. Assign ownership and set targets by quarter.",
      image: featureScorecard,
      imageAlt: "Scorecard grid showing KPIs with targets and actual values",
    },
    {
      icon: Target,
      title: "Quarterly Rocks Review",
      description:
        "Manage 3-5 quarterly priorities per department with progress tracking, status updates (On Track, At Risk, Complete), and accountability assignments. Celebrate goal achievements with visual celebrations.",
      image: featureRocks,
      imageAlt: "Rocks review panel showing quarterly goals with progress bars",
    },
    {
      icon: PartyPopper,
      title: "Headlines & Celebrations",
      description:
        "Automatically surface birthdays and work anniversaries to celebrate your team. Share wins and good news during the Headlines portion of your weekly meetings.",
      image: featureCelebrations,
      imageAlt: "Celebrations panel showing birthdays and work anniversaries",
    },
    {
      icon: AlertTriangle,
      title: "Issues & To-Dos Management",
      description:
        "Right-click on any scorecard or financial metric cell to instantly create an issue. Track issues by severity, link to-dos, and use IDS (Identify, Discuss, Solve) to work through blockers.",
      image: featureIssues,
      imageAlt: "Issues and To-Dos panel with context menu for creating issues",
    },
    {
      icon: DollarSign,
      title: "Financial Summary & Trends",
      description:
        "View monthly financial performance with year-over-year comparisons, sparkline trends, and brand-specific metrics. Track Total Sales, Gross Profit, Department Profit, and ROI across all departments.",
      image: featureFinancial,
      imageAlt: "Financial summary dashboard with monthly data and trends",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Mobile Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              <span className="text-sm font-medium">Install app for the best experience</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate("/install")}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissBanner}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 ${showInstallBanner ? "pt-20" : ""}`}>
        {/* Header */}
        <div className="text-center mb-16">
          {/* SMG Logo */}
          <div className="flex items-center justify-center mb-8">
            <img
              src={smgLogoVertical}
              alt="Steve Marshall Group - 60 Years"
              className="w-48 sm:w-64 lg:w-80 object-contain"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">GO Scorecard Platform</h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Transform your dealership performance with data-driven accountability. Track KPIs, manage quarterly rocks,
            and run effective GO meetings—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleRequestAccess}>
              <Mail className="mr-2 h-5 w-5" />
              Request Access
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate("/install")}>
              <Download className="mr-2 h-5 w-5" />
              Install App
            </Button>
          </div>
        </div>

        {/* Quick Benefits */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Replace Spreadsheets</h3>
            <p className="text-muted-foreground text-sm">
              Stop managing KPIs in scattered spreadsheets. One platform for all your performance data.
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Drive Accountability</h3>
            <p className="text-muted-foreground text-sm">
              Assign ownership to every KPI and rock. Everyone knows what they're responsible for.
            </p>
          </div>

          <div className="text-center p-6 rounded-xl bg-card border border-border">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Better Meetings</h3>
            <p className="text-muted-foreground text-sm">
              Structured 60-minute cadence keeps meetings focused and productive.
            </p>
          </div>
        </div>

        {/* Feature Showcases */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-4">Platform Features</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Everything you need to run high-performance GO meetings and track dealership performance.
          </p>

          <div className="space-y-16">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`flex flex-col ${index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} gap-8 items-center`}
              >
                {/* Image */}
                <div className="flex-1 w-full">
                  <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-card">
                    <img src={feature.image} alt={feature.imageAlt} className="w-full h-auto" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground text-lg">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section - SMG Black & Gold Theme */}
        <div className="text-center py-12 px-8 rounded-2xl bg-[#1a1a1a] text-white mb-8">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Meetings?</h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
            Join Steve Marshall Group dealerships using our platform to drive accountability, track performance, and
            achieve quarterly goals.
          </p>
          <Button size="lg" variant="secondary" onClick={handleRequestAccess}>
            <Mail className="mr-2 h-5 w-5" />
            Request Access
          </Button>
        </div>

        {/* Footer with SMG branding */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={smgLogo} alt="Steve Marshall Group" className="w-48 sm:w-56 object-contain" />
            <span>×</span>
            <span>Dealer Growth Solutions</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">v2.4.0</span>
        </div>
      </div>
    </div>
  );
};

export default SMGIndex;
