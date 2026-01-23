import { useCallback, useEffect, useMemo, useState } from "react";
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

// NOTE: We intentionally DO NOT hardcode column widths here.
// Month columns are measured from the actual DOM so horizontal scrolling stays perfectly aligned.
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
  const [scrollTop, setScrollTop] = useState(0);
  const [monthColumns, setMonthColumns] = useState<Record<string, { left: number; width: number }>>({});

  const computeMonthColumns = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const next: Record<string, { left: number; width: number }> = {};
    for (const m of months) {
      const el = container.querySelector(`[data-month-key="${m.key}"]`) as HTMLElement | null;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      next[m.key] = {
        // Visible left within the container (accounts for horizontal scroll)
        left: rect.left - containerRect.left,
        width: rect.width,
      };
    }
    setMonthColumns(next);
  }, [containerRef, months]);

  // Listen to scroll position of the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollArea = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) return;

    const handleScroll = () => {
      setScrollTop((scrollArea as HTMLElement).scrollTop);
      // Keep month column measurements synced with horizontal scrolling
      computeMonthColumns();
    };

    scrollArea.addEventListener('scroll', handleScroll);

    // Initial values
    setScrollTop((scrollArea as HTMLElement).scrollTop);
    computeMonthColumns();

    return () => {
      scrollArea.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, computeMonthColumns]);

  // Re-measure columns on resize (responsive widths)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => computeMonthColumns());
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, computeMonthColumns]);

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

    travelPeriods.forEach(travel => {
      const travelStart = parseISO(travel.start_date);
      const travelEnd = parseISO(travel.end_date);
      const color = getDestinationColor(travel.destination);

      // Find calls that fall within this travel period
      calls.forEach(call => {
        const callDate = parseISO(call.call_date);
        if (isWithinInterval(callDate, { start: travelStart, end: travelEnd })) {
          const col = monthColumns[call.monthKey];
          if (!col) return;
          
          result.push({
            travel,
            left: col.left,
            width: col.width,
            top: call.rowIndex * rowHeight,
            height: rowHeight,
            color,
            rowId: call.rowId,
          });
        }
      });
    });

    return result;
  }, [travelPeriods, getDestinationColor, calls, rowHeight, monthColumns]);

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
          // Left is already "visible" within the container (computed from DOM),
          // so we only need to adjust vertical position by scrollTop.
          const adjustedLeft = left;
          const adjustedTop = top - scrollTop;
          
          // Check if bar is visible horizontally
          if (adjustedLeft + width < 0 || adjustedLeft > (containerRef.current?.offsetWidth || 0)) return null;

          // Check if bar is visible vertically
          const containerHeight = containerRef.current?.offsetHeight || 0;
          if (adjustedTop + height < 0 || adjustedTop > containerHeight - headerHeight) {
            return null;
          }

          // Clip bar to visible area (container bounds)
          const clippedLeft = Math.max(adjustedLeft, 0);
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
