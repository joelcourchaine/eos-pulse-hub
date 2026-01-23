import { useMemo, useState, useEffect, useRef } from "react";
import { format, parseISO, getDaysInMonth, getDate, isBefore, isAfter, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { TravelPeriod, TravelDestination } from "@/hooks/useTravelPeriods";

interface TravelOverlayProps {
  travelPeriods: TravelPeriod[];
  destinations: TravelDestination[];
  getDestinationColor: (name: string) => string;
  months: { key: string; date: Date }[];
  containerRef: React.RefObject<HTMLDivElement>;
  onEditTravel: (travel: TravelPeriod) => void;
  headerHeight?: number;
}

// Fixed column widths matching ConsultingGrid
const STICKY_COLUMNS_WIDTH = 600; // Dealership(280) + Dept(120) + Contact(120) + Value(80)
const MONTH_COLUMN_WIDTH = 130;
const DELETE_COLUMN_WIDTH = 50;

export function TravelOverlay({
  travelPeriods,
  destinations,
  getDestinationColor,
  months,
  containerRef,
  onEditTravel,
  headerHeight = 32,
}: TravelOverlayProps) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Listen to scroll position of the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollArea = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) return;

    const handleScroll = () => {
      setScrollLeft((scrollArea as HTMLElement).scrollLeft);
    };

    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(container.offsetHeight);
    });

    scrollArea.addEventListener('scroll', handleScroll);
    resizeObserver.observe(container);

    // Initial values
    setScrollLeft((scrollArea as HTMLElement).scrollLeft);
    setContainerHeight(container.offsetHeight);

    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Calculate bar positions for each travel period
  const bars = useMemo(() => {
    return travelPeriods.map(travel => {
      const travelStart = parseISO(travel.start_date);
      const travelEnd = parseISO(travel.end_date);
      const color = getDestinationColor(travel.destination);

      // Find start position
      let leftPx = 0;
      let foundStart = false;
      
      for (let i = 0; i < months.length; i++) {
        const monthStart = startOfMonth(months[i].date);
        const monthEnd = endOfMonth(months[i].date);
        const daysInMonth = getDaysInMonth(months[i].date);
        const columnLeft = STICKY_COLUMNS_WIDTH + (i * MONTH_COLUMN_WIDTH);

        if (!foundStart) {
          // Check if travel starts in this month or before
          if (isBefore(travelStart, monthStart)) {
            // Travel started before this month, start at column edge
            leftPx = columnLeft;
            foundStart = true;
          } else if (!isAfter(travelStart, monthEnd)) {
            // Travel starts in this month
            const dayOfMonth = getDate(travelStart);
            const dayOffset = (dayOfMonth - 1) / daysInMonth;
            leftPx = columnLeft + (dayOffset * MONTH_COLUMN_WIDTH);
            foundStart = true;
          }
        }
      }

      // Find end position (width)
      let rightPx = leftPx;
      
      for (let i = 0; i < months.length; i++) {
        const monthStart = startOfMonth(months[i].date);
        const monthEnd = endOfMonth(months[i].date);
        const daysInMonth = getDaysInMonth(months[i].date);
        const columnLeft = STICKY_COLUMNS_WIDTH + (i * MONTH_COLUMN_WIDTH);
        const columnRight = columnLeft + MONTH_COLUMN_WIDTH;

        if (isAfter(travelEnd, monthEnd)) {
          // Travel extends beyond this month
          rightPx = columnRight;
        } else if (!isBefore(travelEnd, monthStart)) {
          // Travel ends in this month
          const dayOfMonth = getDate(travelEnd);
          const dayOffset = dayOfMonth / daysInMonth;
          rightPx = columnLeft + (dayOffset * MONTH_COLUMN_WIDTH);
          break;
        }
      }

      const width = Math.max(rightPx - leftPx, 4); // Minimum 4px width

      return {
        travel,
        left: leftPx,
        width,
        color,
      };
    });
  }, [travelPeriods, months, getDestinationColor]);

  if (bars.length === 0) return null;

  return (
    <TooltipProvider>
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ 
          top: headerHeight,
          zIndex: 5,
        }}
      >
        {bars.map(({ travel, left, width, color }) => {
          // Adjust left position based on scroll
          const adjustedLeft = left - scrollLeft;
          
          // Check if bar is visible
          if (adjustedLeft + width < STICKY_COLUMNS_WIDTH || adjustedLeft > containerRef.current?.offsetWidth) {
            return null;
          }

          // Clip bar to visible area (after sticky columns)
          const clippedLeft = Math.max(adjustedLeft, STICKY_COLUMNS_WIDTH);
          const clippedWidth = width - (clippedLeft - adjustedLeft);

          if (clippedWidth <= 0) return null;

          return (
            <Tooltip key={travel.id}>
              <TooltipTrigger asChild>
                <div
                  className="absolute pointer-events-auto cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    left: clippedLeft,
                    width: clippedWidth,
                    top: 0,
                    bottom: 0,
                    backgroundColor: color + '30', // 19% opacity in hex
                    borderLeft: adjustedLeft >= STICKY_COLUMNS_WIDTH ? `2px solid ${color}` : 'none',
                    borderRight: `2px solid ${color}`,
                  }}
                  onClick={() => onEditTravel(travel)}
                >
                  {/* Destination label badge */}
                  {clippedWidth >= 50 && (
                    <div 
                      className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap shadow-sm"
                      style={{ 
                        backgroundColor: color,
                        color: 'white',
                      }}
                    >
                      {travel.destination}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {travel.destination}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(travel.start_date), 'MMM d, yyyy')} – {format(parseISO(travel.end_date), 'MMM d, yyyy')}
                  </div>
                  {travel.notes && (
                    <div className="text-xs">{travel.notes}</div>
                  )}
                  <div className="text-xs text-muted-foreground italic">Click to edit</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Legend component showing unique destinations
export function TravelLegend({ 
  destinations,
  getDestinationColor,
}: { 
  destinations: TravelDestination[];
  getDestinationColor: (name: string) => string;
}) {
  if (destinations.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {destinations.slice(0, 6).map(dest => (
        <div 
          key={dest.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border"
          style={{ 
            borderColor: dest.color + '40',
            backgroundColor: dest.color + '15',
          }}
        >
          <div 
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: dest.color }}
          />
          {dest.name}
        </div>
      ))}
      {destinations.length > 6 && (
        <span className="text-xs text-muted-foreground">+{destinations.length - 6} more</span>
      )}
    </div>
  );
}
