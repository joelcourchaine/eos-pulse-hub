import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeriodNavigationProps {
  year: number;
  quarter: number; // -1 = Monthly Trend, 0 = Quarter Trend, 1-4 = specific quarter
  onYearChange: (year: number) => void;
  onQuarterChange: (quarter: number) => void;
  minYear?: number;
  maxYear?: number;
}

export function PeriodNavigation({
  year,
  quarter,
  onYearChange,
  onQuarterChange,
  minYear = 2024,
  maxYear = new Date().getFullYear() + 1,
}: PeriodNavigationProps) {
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [displayedYear, setDisplayedYear] = useState(year);
  const [displayedQuarter, setDisplayedQuarter] = useState(quarter);

  // Sync displayed values when props change externally
  useEffect(() => {
    if (!slideDirection) {
      setDisplayedYear(year);
      setDisplayedQuarter(quarter);
    }
  }, [year, quarter, slideDirection]);

  const isYearMode = quarter === -1 || quarter === 0;
  
  // Calculate boundaries
  const canGoLeft = isYearMode 
    ? year > minYear 
    : !(year === minYear && quarter === 1);
  
  const canGoRight = isYearMode 
    ? year < maxYear 
    : !(year === maxYear && quarter === 4);

  const getLabel = (y: number, q: number) => {
    if (q === -1 || q === 0) return String(y);
    return `Q${q} ${y}`;
  };

  const handleNavigate = (direction: "left" | "right") => {
    // Start slide animation
    setSlideDirection(direction);
    
    // Calculate new values
    let newYear = year;
    let newQuarter = quarter;
    
    if (isYearMode) {
      newYear = direction === "right" ? year + 1 : year - 1;
    } else {
      if (direction === "right") {
        if (quarter === 4) {
          newYear = year + 1;
          newQuarter = 1;
        } else {
          newQuarter = quarter + 1;
        }
      } else {
        if (quarter === 1) {
          newYear = year - 1;
          newQuarter = 4;
        } else {
          newQuarter = quarter - 1;
        }
      }
    }
    
    // Update displayed value after animation starts
    setTimeout(() => {
      setDisplayedYear(newYear);
      setDisplayedQuarter(newQuarter);
      
      // Update actual values
      if (newYear !== year) onYearChange(newYear);
      if (newQuarter !== quarter) onQuarterChange(newQuarter);
      
      // Clear animation
      setTimeout(() => {
        setSlideDirection(null);
      }, 50);
    }, 150);
  };

  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleNavigate("left")}
        disabled={!canGoLeft}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <div className="relative overflow-hidden w-24 h-7 flex items-center justify-center">
        <span
          className={cn(
            "absolute text-lg font-semibold text-muted-foreground transition-all duration-200 ease-out",
            slideDirection === "left" && "animate-slide-out-right",
            slideDirection === "right" && "animate-slide-out-left",
            !slideDirection && "animate-slide-in-center"
          )}
        >
          {getLabel(displayedYear, displayedQuarter)}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleNavigate("right")}
        disabled={!canGoRight}
        className="h-8 w-8"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
