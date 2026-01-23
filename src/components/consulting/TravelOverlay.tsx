import { useMemo, useState, useEffect } from "react";
import { format, parseISO, getDaysInMonth, getDate, isBefore, isAfter, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { TravelPeriod, TravelDestination } from "@/hooks/useTravelPeriods";

interface CallInfo {
  rowId: string;
  rowIndex: number;
  call_date: string;
}

interface TravelOverlayProps {
  travelPeriods: TravelPeriod[];
  destinations: TravelDestination[];
  getDestinationColor: (name: string) => string;
  months: { key: string; date: Date }[];
  containerRef: React.RefObject<HTMLDivElement>;
  onEditTravel: (travel: TravelPeriod) => void;
  headerHeight?: number;
  calls?: CallInfo[]; // All calls with their row info
  rowHeight?: number;
}

// Fixed column widths matching ConsultingGrid
const STICKY_COLUMNS_WIDTH = 600; // Dealership(280) + Dept(120) + Contact(120) + Value(80)
const MONTH_COLUMN_WIDTH = 130;
const ROW_HEIGHT = 32; // h-8 = 2rem = 32px

export function TravelOverlay({
  travelPeriods,
  destinations,
  getDestinationColor,
  months,
  containerRef,
  onEditTravel,
  headerHeight = 32,
  calls = [],
  rowHeight = ROW_HEIGHT,
}: TravelOverlayProps) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  // Listen to scroll position of the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollArea = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) return;

    const handleScroll = () => {
      setScrollLeft((scrollArea as HTMLElement).scrollLeft);
      setScrollTop((scrollArea as HTMLElement).scrollTop);
    };

    scrollArea.addEventListener('scroll', handleScroll);

    // Initial values
    setScrollLeft((scrollArea as HTMLElement).scrollLeft);
    setScrollTop((scrollArea as HTMLElement).scrollTop);

    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef]);

  // Calculate bar positions for each travel period - now per-row
  const bars = useMemo(() => {
    const result: {
      travel: TravelPeriod;
      left: number;
      width: number;
      top: number;
      height: number;
      color: string;
      rowId: string;
    }[] = [];

    travelPeriods.forEach(travel => {
      const travelStart = parseISO(travel.start_date);
      const travelEnd = parseISO(travel.end_date);
      const color = getDestinationColor(travel.destination);

      // Find calls that fall within this travel period
      const affectedRows = new Set<number>();
      const affectedRowIds: string[] = [];
      
      calls.forEach(call => {
        const callDate = parseISO(call.call_date);
        if (isWithinInterval(callDate, { start: travelStart, end: travelEnd })) {
          if (!affectedRows.has(call.rowIndex)) {
            affectedRows.add(call.rowIndex);
            affectedRowIds.push(call.rowId);
          }
        }
      });

      // Calculate horizontal position based on the month columns
      // Find which month the travel starts in and ends in
      let leftPx = STICKY_COLUMNS_WIDTH;
      let rightPx = STICKY_COLUMNS_WIDTH;
      
      for (let i = 0; i < months.length; i++) {
        const monthDate = months[i].date;
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const daysInMonth = getDaysInMonth(monthDate);
        const columnLeft = STICKY_COLUMNS_WIDTH + (i * MONTH_COLUMN_WIDTH);
        const columnRight = columnLeft + MONTH_COLUMN_WIDTH;

        // Check if travel start falls in this month
        if (!isBefore(travelStart, monthStart) && !isAfter(travelStart, monthEnd)) {
          const dayOfMonth = getDate(travelStart);
          const dayOffset = (dayOfMonth - 1) / daysInMonth;
          leftPx = columnLeft + (dayOffset * MONTH_COLUMN_WIDTH);
        } else if (isBefore(travelStart, monthStart) && leftPx === STICKY_COLUMNS_WIDTH) {
          leftPx = columnLeft;
        }

        // Check if travel end falls in this month
        if (!isBefore(travelEnd, monthStart) && !isAfter(travelEnd, monthEnd)) {
          const dayOfMonth = getDate(travelEnd);
          const dayOffset = dayOfMonth / daysInMonth;
          rightPx = columnLeft + (dayOffset * MONTH_COLUMN_WIDTH);
        } else if (isAfter(travelEnd, monthEnd)) {
          rightPx = columnRight;
        }
      }

      const width = Math.max(rightPx - leftPx, 4);

      // Create a bar for each affected row
      if (affectedRowIds.length > 0) {
        affectedRowIds.forEach((rowId, idx) => {
          const affectedRowArray = Array.from(affectedRows);
          const rowIndex = affectedRowArray[idx];
          
          result.push({
            travel,
            left: leftPx,
            width,
            top: rowIndex * rowHeight,
            height: rowHeight,
            color,
            rowId,
          });
        });
      }
    });

    return result;
  }, [travelPeriods, months, getDestinationColor, calls, rowHeight]);

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
        {bars.map(({ travel, left, width, top, height, color, rowId }) => {
          // Adjust position based on scroll
          const adjustedLeft = left - scrollLeft;
          const adjustedTop = top - scrollTop;
          
          // Check if bar is visible horizontally
          if (adjustedLeft + width < STICKY_COLUMNS_WIDTH || adjustedLeft > (containerRef.current?.offsetWidth || 0)) {
            return null;
          }

          // Check if bar is visible vertically
          const containerHeight = containerRef.current?.offsetHeight || 0;
          if (adjustedTop + height < 0 || adjustedTop > containerHeight - headerHeight) {
            return null;
          }

          // Clip bar to visible area (after sticky columns)
          const clippedLeft = Math.max(adjustedLeft, STICKY_COLUMNS_WIDTH);
          const clippedWidth = width - (clippedLeft - adjustedLeft);

          if (clippedWidth <= 0) return null;

          return (
            <Tooltip key={`${travel.id}-${rowId}`}>
              <TooltipTrigger asChild>
                <div
                  className="absolute pointer-events-auto cursor-pointer transition-opacity hover:opacity-90 rounded-sm"
                  style={{
                    left: clippedLeft,
                    width: clippedWidth,
                    top: adjustedTop,
                    height: height,
                    backgroundColor: color + '40', // ~25% opacity
                  }}
                  onClick={() => onEditTravel(travel)}
                />
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
