import { useState, useEffect, useCallback, useRef } from "react";
import type { OutcomeData } from "@/types";
import { getProposalDraftsStorageKey } from "@/lib/proposalConstants";
import { useUnsavedChanges } from "./useUnsavedChanges";

export interface ProposalDraft {
    id: string;
    title: string;
    description: string;
    outcomes: OutcomeData[];
    timestamp: number;
    orgId: string;
}

export interface ProposalFormData {
    title: string;
    description: string;
    outcomes: OutcomeData[];
}

interface UseProposalDraftsOptions {
    orgId: string;
    formData: ProposalFormData;
    initialFormData: ProposalFormData;
    setFormData: (data: ProposalFormData) => void;
    setStep: (step: number) => void;
    onDraftLoad?: (draft: ProposalDraft) => void;
}

export function useProposalDrafts({
    orgId,
    formData,
    initialFormData,
    setFormData,
    setStep,
    onDraftLoad,
}: UseProposalDraftsOptions) {
    const [showDraftBanner, setShowDraftBanner] = useState(false);
    const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

    const DRAFTS_KEY = getProposalDraftsStorageKey(orgId);

    // Load all drafts on mount
    useEffect(() => {
        const draftsString = localStorage.getItem(DRAFTS_KEY);
        if (draftsString) {
            try {
                const loadedDrafts: ProposalDraft[] = JSON.parse(draftsString);
                setDrafts(loadedDrafts);
                if (loadedDrafts.length > 0) {
                    setShowDraftBanner(true);
                }
            } catch (error) {
                console.error("Failed to load drafts:", error);
            }
        }
    }, [DRAFTS_KEY]);

    // Check if form has content
    const hasContent = useCallback(() => {
        return (
            formData.title.trim() !== "" ||
            formData.description.trim() !== "" ||
            formData.outcomes.some((o) => o.actions.length > 0)
        );
    }, [formData]);

    // Check if there are unsaved changes compared to current draft
    const hasUnsavedChanges = useCallback(() => {
        if (!currentDraftId) {
            return hasContent();
        }
        const currentDraft = drafts.find((d) => d.id === currentDraftId);
        if (!currentDraft) return true;
        return (
            formData.title !== currentDraft.title ||
            formData.description !== currentDraft.description ||
            JSON.stringify(formData.outcomes) !== JSON.stringify(currentDraft.outcomes)
        );
    }, [formData, currentDraftId, drafts, hasContent]);

    // Load specific draft (internal)
    const loadDraftInternal = useCallback(
        (draftId: string) => {
            const draft = drafts.find((d) => d.id === draftId);
            if (draft) {
                setFormData({
                    title: draft.title,
                    description: draft.description,
                    outcomes: draft.outcomes,
                });
                onDraftLoad?.(draft);
                setCurrentDraftId(draftId);
                setShowDraftBanner(false);
            }
        },
        [drafts, setFormData, onDraftLoad]
    );

    // Save current draft
    const saveDraft = useCallback(() => {
        const draftId = currentDraftId || `draft-${Date.now()}`;
        const draft: ProposalDraft = {
            id: draftId,
            ...formData,
            timestamp: Date.now(),
            orgId,
        };

        const updatedDrafts = drafts.filter((d) => d.id !== draftId);
        updatedDrafts.push(draft);
        setDrafts(updatedDrafts);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(updatedDrafts));
        setCurrentDraftId(draftId);
    }, [currentDraftId, formData, orgId, drafts, DRAFTS_KEY]);

    // Unsaved changes hook integration
    const unsavedChanges = useUnsavedChanges({
        hasUnsavedChanges,
        onSave: saveDraft,
    });

    // Can save: has content and has unsaved changes
    const canSave = hasContent() && hasUnsavedChanges();

    // Keyboard shortcut for saving (Cmd/Ctrl+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (canSave) {
                    saveDraft();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [canSave, saveDraft]);

    // Load draft with unsaved changes confirmation
    const handleLoadDraft = useCallback(
        (draftId: string) => {
            if (draftId !== currentDraftId) {
                unsavedChanges.confirmAction(() => loadDraftInternal(draftId));
            } else {
                loadDraftInternal(draftId);
            }
        },
        [currentDraftId, unsavedChanges, loadDraftInternal]
    );

    // Start new draft with auto-save
    const handleNewDraft = useCallback(() => {
        const currentDraft = currentDraftId ? drafts.find((d) => d.id === currentDraftId) : null;
        if (hasContent() && hasUnsavedChanges() && currentDraft) {
            saveDraft();
        }
        setFormData(initialFormData);
        setStep(0);
        setCurrentDraftId(null);
    }, [currentDraftId, drafts, hasContent, hasUnsavedChanges, saveDraft, setFormData, initialFormData, setStep]);

    // Delete draft
    const handleDeleteDraft = useCallback(
        (draftId: string) => {
            const isCurrentDraft = draftId === currentDraftId;
            if (isCurrentDraft) {
                setFormData(initialFormData);
                setStep(0);
            }

            const updatedDrafts = drafts.filter((d) => d.id !== draftId);
            setDrafts(updatedDrafts);
            localStorage.setItem(DRAFTS_KEY, JSON.stringify(updatedDrafts));

            if (currentDraftId === draftId) {
                setCurrentDraftId(null);
            }
            if (updatedDrafts.length === 0) {
                setShowDraftBanner(false);
            }
            setDraftToDelete(null);
        },
        [currentDraftId, drafts, DRAFTS_KEY, setFormData, initialFormData, setStep]
    );

    // Discard specific draft (for external use without resetting form)
    const discardDraft = useCallback(
        (draftId: string) => {
            const updatedDrafts = drafts.filter((d) => d.id !== draftId);
            setDrafts(updatedDrafts);
            localStorage.setItem(DRAFTS_KEY, JSON.stringify(updatedDrafts));
            if (currentDraftId === draftId) {
                setCurrentDraftId(null);
            }
            if (updatedDrafts.length === 0) {
                setShowDraftBanner(false);
            }
        },
        [drafts, DRAFTS_KEY, currentDraftId]
    );

    // Auto-save on unmount
    const autoSaveDraft = useCallback(() => {
        if (!hasContent()) return;

        const draftId = currentDraftId || `draft-${Date.now()}`;
        const draft: ProposalDraft = {
            id: draftId,
            ...formData,
            timestamp: Date.now(),
            orgId,
        };

        const existingDraftsString = localStorage.getItem(DRAFTS_KEY);
        const existingDrafts: ProposalDraft[] = existingDraftsString ? JSON.parse(existingDraftsString) : [];
        const updatedDrafts = existingDrafts.filter((d) => d.id !== draftId);
        updatedDrafts.push(draft);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(updatedDrafts));
    }, [hasContent, currentDraftId, formData, orgId, DRAFTS_KEY]);

    // Auto-save draft on unmount
    const autoSaveDraftRef = useRef(autoSaveDraft);
    autoSaveDraftRef.current = autoSaveDraft;
    useEffect(() => {
        return () => {
            autoSaveDraftRef.current();
        };
    }, []);

    // Clear all drafts (call this after successful submission)
    const clearAllDrafts = useCallback(() => {
        localStorage.removeItem(DRAFTS_KEY);
        setDrafts([]);
        setCurrentDraftId(null);
        setShowDraftBanner(false);
    }, [DRAFTS_KEY]);

    return {
        // State
        showDraftBanner,
        drafts,
        currentDraftId,
        draftToDelete,
        canSave,

        // Setters
        setDraftToDelete,

        // Actions
        saveDraft,
        handleLoadDraft,
        handleNewDraft,
        handleDeleteDraft,
        discardDraft,
        autoSaveDraft,
        clearAllDrafts,

        // Unsaved changes
        hasUnsavedChanges,
        unsavedChanges,
    };
}
