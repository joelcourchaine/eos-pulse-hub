import { useMemo, useState, useEffect } from "react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { TravelPeriod, TravelDestination } from "@/hooks/useTravelPeriods";

interface CallInfo {
  rowId: string;
  rowIndex: number;
  call_date: string;
  monthKey: string; // The month column this call appears in
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

  // Calculate bar positions for each travel period - positioned in the column where the call appears
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

    // Build a map of month key to column index
    const monthToColumnIndex = new Map<string, number>();
    months.forEach((m, idx) => {
      monthToColumnIndex.set(m.key, idx);
    });

    travelPeriods.forEach(travel => {
      const travelStart = parseISO(travel.start_date);
      const travelEnd = parseISO(travel.end_date);
      const color = getDestinationColor(travel.destination);

      // Find calls that fall within this travel period
      calls.forEach(call => {
        const callDate = parseISO(call.call_date);
        if (isWithinInterval(callDate, { start: travelStart, end: travelEnd })) {
          // Position the bar in the column where this call appears (based on monthKey)
          const columnIndex = monthToColumnIndex.get(call.monthKey);
          if (columnIndex === undefined) return;

          const columnLeft = STICKY_COLUMNS_WIDTH + (columnIndex * MONTH_COLUMN_WIDTH);
          
          result.push({
            travel,
            left: columnLeft,
            width: MONTH_COLUMN_WIDTH,
            top: call.rowIndex * rowHeight,
            height: rowHeight,
            color,
            rowId: call.rowId,
          });
        }
      });
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
