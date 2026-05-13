import { useState, useEffect, useCallback } from "react";
import { useBlocker, useNavigate } from "react-router";

interface UseUnsavedChangesOptions {
    hasUnsavedChanges: () => boolean;
    onSave?: () => void;
}

export function useUnsavedChanges({ hasUnsavedChanges, onSave }: UseUnsavedChangesOptions) {
    const navigate = useNavigate();
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Block in-app navigation when there are unsaved changes
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname
    );

    // Handle blocked navigation
    useEffect(() => {
        if (blocker.state === "blocked") {
            setShowUnsavedWarning(true);
        }
    }, [blocker.state]);

    // Warn before page reload/close with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                // Modern browsers ignore custom messages and show their own
                // But we still need to set returnValue for the dialog to appear
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [hasUnsavedChanges]);

    // Check for unsaved changes before performing an action
    const confirmNavigation = useCallback(
        (path: string) => {
            if (hasUnsavedChanges()) {
                setPendingNavigation(path);
                setShowUnsavedWarning(true);
            } else {
                navigate(path);
            }
        },
        [hasUnsavedChanges, navigate]
    );

    // Check for unsaved changes before performing a custom action
    const confirmAction = useCallback(
        (action: () => void) => {
            if (hasUnsavedChanges()) {
                setPendingAction(() => action);
                setShowUnsavedWarning(true);
            } else {
                action();
            }
        },
        [hasUnsavedChanges]
    );

    // Save and proceed with navigation or action
    const handleSaveAndLeave = useCallback(() => {
        onSave?.();
        setShowUnsavedWarning(false);

        // Handle pending action (like loading a draft)
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
        // Handle pending navigation
        else if (pendingNavigation) {
            navigate(pendingNavigation);
            setPendingNavigation(null);
        }
        // Handle blocked navigation
        else if (blocker.state === "blocked") {
            blocker.proceed();
        }
    }, [onSave, pendingAction, pendingNavigation, blocker, navigate]);

    // Leave without saving
    const handleLeaveWithoutSaving = useCallback(() => {
        setShowUnsavedWarning(false);

        // Handle pending action (like loading a draft)
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
        // Handle pending navigation
        else if (pendingNavigation) {
            navigate(pendingNavigation);
            setPendingNavigation(null);
        }
        // Handle blocked navigation
        else if (blocker.state === "blocked") {
            blocker.proceed();
        }
    }, [pendingAction, pendingNavigation, blocker, navigate]);

    // Cancel navigation
    const handleCancelNavigation = useCallback(() => {
        setShowUnsavedWarning(false);
        setPendingNavigation(null);
        setPendingAction(null);
        if (blocker.state === "blocked") {
            blocker.reset();
        }
    }, [blocker]);

    return {
        showUnsavedWarning,
        confirmNavigation,
        confirmAction,
        handleSaveAndLeave,
        handleLeaveWithoutSaving,
        handleCancelNavigation,
    };
}
