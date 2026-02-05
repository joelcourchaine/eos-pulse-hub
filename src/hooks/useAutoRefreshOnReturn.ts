 import { useEffect, useRef } from "react";
 
 /**
 * Hook that automatically refreshes the page when the user returns
 * after being away for an extended period.
 * 
 * @param thresholdMs - Time in milliseconds after which to trigger refresh (default: 2 hours)
 */
 export function useAutoRefreshOnReturn(thresholdMs: number = 2 * 60 * 60 * 1000) {
   const lastActiveRef = useRef(Date.now());
 
   useEffect(() => {
     const handleVisibilityChange = () => {
       if (!document.hidden) {
         // User is returning to the tab
         const inactiveTime = Date.now() - lastActiveRef.current;
         if (inactiveTime > thresholdMs) {
           window.location.reload();
         }
       } else {
         // User is leaving the tab - record the time
         lastActiveRef.current = Date.now();
       }
     };
 
     document.addEventListener("visibilitychange", handleVisibilityChange);
     return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
   }, [thresholdMs]);
 }