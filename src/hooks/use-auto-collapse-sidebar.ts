import { useEffect, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";

const COLLAPSE_BREAKPOINT = 1400;
const HIDE_BREAKPOINT = 1100;

type SidebarTier = "expanded" | "collapsed" | "hidden";

function getTier(width: number): SidebarTier {
  if (width < HIDE_BREAKPOINT) return "hidden";
  if (width < COLLAPSE_BREAKPOINT) return "collapsed";
  return "expanded";
}

export function useAutoCollapseSidebar() {
  const { setOpen, isMobile } = useSidebar();
  const [isAutoHidden, setIsAutoHidden] = useState(false);
  const lastTier = useRef<SidebarTier>(getTier(window.innerWidth));

  useEffect(() => {
    if (isMobile) return;

    const handleResize = () => {
      const tier = getTier(window.innerWidth);

      if (tier !== lastTier.current) {
        lastTier.current = tier;

        if (tier === "hidden") {
          setOpen(false);
          setIsAutoHidden(true);
        } else if (tier === "collapsed") {
          setOpen(false);
          setIsAutoHidden(false);
        } else {
          setOpen(true);
          setIsAutoHidden(false);
        }
      }
    };

    // Apply initial tier
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setOpen, isMobile]);

  return { isAutoHidden };
}
