import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StickyHScrollbarProps = {
  /** Fixed positioning (in viewport coordinates) */
  left: number;
  width: number;
  /** Scroll metrics from the real scroll container */
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  /** Set scrollLeft on the real scroll container */
  onSetScrollLeft: (nextScrollLeft: number) => void;
  position: "top" | "bottom";
  offsetPx: number;
  /** Whether to render (e.g. header out of view) */
  show: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function StickyHScrollbar({
  left,
  width,
  scrollWidth,
  clientWidth,
  scrollLeft,
  onSetScrollLeft,
  position,
  offsetPx,
  show,
}: StickyHScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const maxScrollLeft = useMemo(() => Math.max(0, scrollWidth - clientWidth), [scrollWidth, clientWidth]);

  const { thumbWidthPx, thumbLeftPx } = useMemo(() => {
    const trackWidth = Math.max(0, width);
    if (trackWidth === 0 || scrollWidth <= 0 || clientWidth <= 0) {
      return { thumbWidthPx: 0, thumbLeftPx: 0 };
    }

    const ratio = clientWidth / scrollWidth;
    const minThumb = 56;
    const w = clamp(Math.round(trackWidth * ratio), minThumb, trackWidth);

    const denom = Math.max(1, maxScrollLeft);
    const leftPx = Math.round(((clamp(scrollLeft, 0, maxScrollLeft) / denom) * (trackWidth - w)) || 0);
    return { thumbWidthPx: w, thumbLeftPx: leftPx };
  }, [width, scrollWidth, clientWidth, scrollLeft, maxScrollLeft]);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const thumbCenter = x - thumbWidthPx / 2;
      const maxThumbLeft = Math.max(0, rect.width - thumbWidthPx);
      const nextThumbLeft = clamp(thumbCenter, 0, maxThumbLeft);
      const nextScrollLeft = maxThumbLeft === 0 ? 0 : (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
      onSetScrollLeft(nextScrollLeft);
    },
    [maxScrollLeft, onSetScrollLeft, thumbWidthPx]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const maxThumbLeft = Math.max(0, rect.width - thumbWidthPx);
      const dx = e.clientX - dragStartXRef.current;
      const startThumbLeft = maxThumbLeft === 0 ? 0 : (clamp(dragStartScrollLeftRef.current, 0, maxScrollLeft) / maxScrollLeft) * maxThumbLeft;
      const nextThumbLeft = clamp(startThumbLeft + dx, 0, maxThumbLeft);
      const nextScrollLeft = maxThumbLeft === 0 ? 0 : (nextThumbLeft / maxThumbLeft) * maxScrollLeft;
      onSetScrollLeft(nextScrollLeft);
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [maxScrollLeft, onSetScrollLeft, thumbWidthPx]);

  const canScroll = show && scrollWidth > clientWidth + 1 && width > 0;
  if (!canScroll) return null;

  const fixedStyle: React.CSSProperties =
    position === "top"
      ? { position: "fixed", left, width, top: offsetPx, zIndex: 9999 }
      : { position: "fixed", left, width, bottom: offsetPx, zIndex: 9999 };

  return createPortal(
    <div className="pointer-events-none" style={fixedStyle}>
      <div className="pointer-events-auto">
        <div
          ref={trackRef}
          className="relative h-[22px] rounded-lg border bg-muted/70 shadow-sm backdrop-blur-sm"
          onPointerDown={(e) => {
            // Clicking on the track jumps to that position (except when starting drag on thumb)
            if ((e.target as HTMLElement)?.dataset?.thumb === "1") return;
            setFromClientX(e.clientX);
          }}
        >
          <div
            data-thumb="1"
            className="absolute top-[3px] h-[16px] rounded-md bg-foreground/20 hover:bg-foreground/30"
            style={{ width: `${thumbWidthPx}px`, left: `${thumbLeftPx}px` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              draggingRef.current = true;
              setIsDragging(true);
              dragStartXRef.current = e.clientX;
              dragStartScrollLeftRef.current = scrollLeft;
              (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
            }}
          />
          {/* subtle focus/drag affordance */}
          <div className={isDragging ? "absolute inset-0 rounded-lg ring-2 ring-ring/40" : ""} />
        </div>
      </div>
    </div>,
    document.body
  );
}
