import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataCoverageBadgeProps {
  monthsWithData: number;
  totalMonths: number;
}

export function DataCoverageBadge({ monthsWithData, totalMonths }: DataCoverageBadgeProps) {
  const isComplete = monthsWithData === totalMonths;
  
  if (isComplete) {
    return null; // Don't show badge if all months have data
  }

  const percentage = totalMonths > 0 ? Math.round((monthsWithData / totalMonths) * 100) : 0;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`ml-2 text-xs font-normal ${
              monthsWithData === 0 
                ? "border-destructive/50 text-destructive" 
                : "border-warning/50 text-warning-foreground bg-warning/10"
            }`}
          >
            {monthsWithData}/{totalMonths} months
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {monthsWithData === 0 
              ? "No data available for the selected period" 
              : `Data available for ${monthsWithData} of ${totalMonths} months (${percentage}%)`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
