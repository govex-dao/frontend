import { useState, useEffect } from "react";

/**
 * Hook to detect if the current screen size is mobile
 * @param breakpoint - The breakpoint width in pixels (default: 1024 for lg breakpoint)
 * @returns Boolean indicating if the screen is mobile-sized
 */
export function useIsMobile(breakpoint: number = 1024): boolean {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };

        // Check on mount
        checkMobile();

        // Add event listener for window resize
        window.addEventListener("resize", checkMobile);

        // Cleanup listener on unmount
        return () => window.removeEventListener("resize", checkMobile);
    }, [breakpoint]);

    return isMobile;
}
