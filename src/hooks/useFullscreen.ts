import { useState, useEffect, useCallback } from "react";

interface UseFullscreenProps {
    elementRef: React.RefObject<HTMLElement | null>;
    onResize?: () => void;
}

/**
 * Hook to manage fullscreen mode for an element
 * @param elementRef - Reference to the element to make fullscreen
 * @param onResize - Optional callback to run after fullscreen change
 * @returns Object with isFullscreen state and toggleFullscreen function
 */
export function useFullscreen({ elementRef, onResize }: UseFullscreenProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = useCallback(async () => {
        if (!elementRef.current) return;

        try {
            if (!document.fullscreenElement) {
                await elementRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (error) {
            console.error("Error toggling fullscreen:", error);
        }
    }, [elementRef]);

    // Listen for fullscreen changes (e.g., user pressing ESC)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);

            // Call onResize callback after fullscreen change
            if (onResize) {
                setTimeout(() => {
                    onResize();
                }, 100);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [onResize]);

    return {
        isFullscreen,
        toggleFullscreen,
    };
}
