import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, Users, Mail, Gauge, Calendar, CheckSquare, PartyPopper, AlertTriangle, DollarSign, Download, X } from "lucide-react";
import goLogo from "@/assets/go-logo.png";
import featureGauges from "@/assets/feature-gauges.png";
import featureMeeting from "@/assets/feature-meeting.png";
import featureScorecard from "@/assets/feature-scorecard-final.png";
import featureRocks from "@/assets/feature-rocks.png";
import featureCelebrations from "@/assets/feature-celebrations.png";
import featureIssues from "@/assets/feature-issues.png";
import featureFinancial from "@/assets/feature-financial.png";
const Index = () => {
  const navigate = useNavigate();
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check if on mobile and not already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const bannerDismissed = sessionStorage.getItem('installBannerDismissed');
    
    if (isMobile && !isStandalone && !bannerDismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    sessionStorage.setItem('installBannerDismissed', 'true');
    setShowInstallBanner(false);
  };

  const handleRequestAccess = () => {
    window.location.href = "mailto:info@dealergrowth.solutions?subject=Request Access to GO Scorecard Platform&body=Hi, I'm interested in getting access to the GO Scorecard Platform for my dealership.%0A%0ADealership Name:%0AContact Name:%0APhone:%0A";
  };

  const features = [
    {
      icon: Gauge,
      title: "Real-Time KPI Gauges",
      description: "See your department's performance at a glance with color-coded gauges showing On Track, At Risk, and Off Track metrics. Know exactly where you stand before every meeting.",
      image: featureGauges,
      imageAlt: "KPI performance gauges showing on track, at risk, and off track metrics",
    },
    {
      icon: Calendar,
      title: "GO Meeting Framework",
      description: "Run structured 60-minute weekly meetings with built-in timer and guided sections: Segue, Scorecard Review, Rock Review, Headlines, Issues & To-Dos, and Conclude. Keep your team aligned and accountable.",
      image: featureMeeting,
      imageAlt: "GO Meeting Framework interface with tabs and timer",
    },
    {
      icon: BarChart3,
      title: "Weekly & Monthly Scorecards",
      description: "Track KPIs with auto-calculated variances and color-coded status indicators. Weekly data rolls up to monthly, quarterly, and yearly views. Assign ownership and set targets by quarter.",
      image: featureScorecard,
      imageAlt: "Scorecard grid showing KPIs with targets and actual values",
    },
    {
      icon: Target,
      title: "Quarterly Rocks Review",
      description: "Manage 3-5 quarterly priorities per department with progress tracking, status updates (On Track, At Risk, Complete), and accountability assignments. Celebrate goal achievements with visual celebrations.",
      image: featureRocks,
      imageAlt: "Rocks review panel showing quarterly goals with progress bars",
    },
    {
      icon: PartyPopper,
      title: "Headlines & Celebrations",
      description: "Automatically surface birthdays and work anniversaries to celebrate your team. Share wins and good news during the Headlines portion of your weekly meetings.",
      image: featureCelebrations,
      imageAlt: "Celebrations panel showing birthdays and work anniversaries",
    },
    {
      icon: AlertTriangle,
      title: "Issues & To-Dos Management",
      description: "Right-click on any scorecard or financial metric cell to instantly create an issue. Track issues by severity, link to-dos, and use IDS (Identify, Discuss, Solve) to work through blockers.",
      image: featureIssues,
      imageAlt: "Issues and To-Dos panel with context menu for creating issues",
    },
    {
      icon: DollarSign,
      title: "Financial Summary & Trends",
      description: "View monthly financial performance with year-over-year comparisons, sparkline trends, and brand-specific metrics. Track Total Sales, Gross Profit, Department Profit, and ROI across all departments.",
      image: featureFinancial,
      imageAlt: "Financial summary dashboard with monthly data and trends",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Mobile Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground p-3 flex items-center justify-between z-50 shadow-lg">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5" />
            <span className="text-sm font-medium">Install app for the best experience</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/install")}
            >
              Install
            </Button>
            <button
              onClick={dismissBanner}
              className="p-1 hover:bg-primary-foreground/20 rounded"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${showInstallBanner ? 'pt-20' : ''}`}>
        {/* Header */}
        <div className="text-center mb-16">
          <img src={goLogo} alt="GO Logo" className="h-20 w-20 mx-auto mb-6 rounded-2xl shadow-lg" />
          <h1 className="text-5xl font-bold text-foreground mb-4">
            GO Scorecard Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your dealership performance with data-driven accountability.
            Track KPIs, manage quarterly rocks, and run effective GO meetings—all in one place.
          </p>
          <div className="mt-8 flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={handleRequestAccess}>
              <Mail className="mr-2 h-4 w-4" />
              Request Access
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate("/install")}>
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
          </div>
        </div>

        {/* Quick Benefits */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow text-center">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Replace Spreadsheets</h3>
            <p className="text-muted-foreground">
              Stop managing KPIs in scattered spreadsheets. One platform for all your performance data.
            </p>
          </div>

          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow text-center">
            <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 mx-auto">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Drive Accountability</h3>
            <p className="text-muted-foreground">
              Assign ownership to every KPI and rock. Everyone knows what they're responsible for.
            </p>
          </div>

          <div className="bg-card p-8 rounded-xl border border-border hover:shadow-lg transition-shadow text-center">
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4 mx-auto">
              <Users className="h-6 w-6 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Better Meetings</h3>
            <p className="text-muted-foreground">
              Structured 60-minute cadence keeps meetings focused and productive.
            </p>
          </div>
        </div>

        {/* Feature Showcases */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-4">Platform Features</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Everything you need to run high-performance GO meetings and track dealership performance.
          </p>
          
          <div className="space-y-20">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-12 items-center`}
              >
                {/* Image */}
                <div className="w-full lg:w-3/5">
                  <div className="relative rounded-xl overflow-hidden border border-border shadow-lg bg-card">
                    <img
                      src={feature.image} 
                      alt={feature.imageAlt}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
                
                {/* Content */}
                <div className="w-full lg:w-2/5 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Meetings?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Join dealership groups using our platform to drive accountability, track performance, and achieve quarterly goals.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={handleRequestAccess}
          >
            <Mail className="mr-2 h-4 w-4" />
            Request Access
          </Button>
        </div>

        {/* Version Badge */}
        <div className="mt-12 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            v2.4.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default Index;
