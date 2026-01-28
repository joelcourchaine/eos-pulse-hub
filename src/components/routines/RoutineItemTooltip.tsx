import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Info, ExternalLink, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReportInfo {
  type: "internal" | "external" | "manual";
  path?: string;
  instructions?: string;
}

interface RoutineItemTooltipProps {
  title: string;
  description?: string;
  reportInfo?: ReportInfo;
  children?: React.ReactNode;
}

export const RoutineItemTooltip = ({
  title,
  description,
  reportInfo,
  children,
}: RoutineItemTooltipProps) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    if (!reportInfo?.path) return;

    if (reportInfo.type === "external") {
      window.open(reportInfo.path, "_blank");
    } else if (reportInfo.type === "internal") {
      navigate(reportInfo.path);
    }
  };

  const hasContent = description || reportInfo?.instructions;

  if (!hasContent) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="start">
        <div className="space-y-3 p-4">
          <div className="font-medium text-sm">{title}</div>

          {description && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Why We Do This
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          )}

          {reportInfo?.instructions && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <MapPin className="h-3 w-3" />
                How to Access
              </div>
              <p className="text-sm text-muted-foreground">
                {reportInfo.instructions}
              </p>
              {reportInfo.path && reportInfo.type !== "manual" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={handleNavigate}
                >
                  {reportInfo.type === "external" ? (
                    <>
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      Open in New Tab
                    </>
                  ) : (
                    <>
                      Go to Report
                      <ExternalLink className="h-3.5 w-3.5 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
