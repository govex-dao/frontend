import { useState, useCallback } from "react";
import type { ActionData, ActionType, OutcomeData, ProposalAction } from "@/types";
import { DEFAULT_OUTCOME } from "@/lib/proposalConstants";
import { useProposalDrafts } from "./useProposalDrafts";
import { useFormValidation, type Validations } from "./useFormValidation";

// Proposal form data type
export interface ProposalFormData {
    title: string;
    description: string;
    outcomes: OutcomeData[];
}

// Define validation rules - single source of truth
export const proposalValidationRules: Validations<Pick<ProposalFormData, "title" | "description">> = {
    title: { required: true, label: "Title", step: 0 },
    description: { required: true, label: "Description", step: 0 },
};

// Initial form values
export const initialProposalFormData: ProposalFormData = {
    title: "",
    description: "",
    outcomes: [DEFAULT_OUTCOME],
};

// Custom validation for outcomes (more complex than string fields)
export const validateOutcomes = (outcomes: OutcomeData[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check outcomes exist
    if (outcomes.length === 0) {
        errors.push("At least one outcome is required");
        return { isValid: false, errors };
    }

    // Check all outcomes have names
    const unnamedOutcomes = outcomes.filter((outcome) => !outcome.name.trim());
    if (unnamedOutcomes.length > 0) {
        errors.push(`${unnamedOutcomes.length} outcome(s) need a name`);
    }

    // Check all outcomes have at least one action
    const outcomesWithoutActions = outcomes.filter((outcome) => outcome.actions.length === 0);
    if (outcomesWithoutActions.length > 0) {
        const outcomeNames = outcomesWithoutActions.map((o) => o.name || "Unnamed").join(", ");
        errors.push(`${outcomesWithoutActions.length} outcome(s) need at least one action: ${outcomeNames}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// Tab completion state calculator
export const getTabCompletionState = (formData: ProposalFormData) => {
    const isDetailsComplete = formData.title.trim().length > 0 && formData.description.trim().length > 0;
    const isOutcomesComplete = formData.outcomes.every((outcome) => outcome.name.trim().length > 0);
    const isActionsComplete = formData.outcomes.every((outcome) => outcome.actions.length > 0);
    return [isDetailsComplete, isOutcomesComplete, isActionsComplete];
};

/**
 * Comprehensive hook for managing proposal creation state and logic
 * Consolidates all the complex state management from Create.tsx
 */
export function useProposalCreation(orgId: string) {
    // Additional UI state (beyond form data)
    const [selectedOutcomeId, setSelectedOutcomeId] = useState("pass");
    const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
    const [editingOutcomeName, setEditingOutcomeName] = useState("");

    // Form validation and submission
    const formValidation = useFormValidation({
        initialFormData: initialProposalFormData,
        validationRules: proposalValidationRules,
        additionalValidation: (formData) => validateOutcomes(formData.outcomes),
        getTabCompletionState,
    });

    const {
        formData,
        setFormData,
        updateField,
        step,
        setStep,
        showSubmitModal,
        setShowSubmitModal,
        hasError,
        attemptedSubmit,
        tabCompletionState,
        getTabErrors,
        onSubmit,
    } = formValidation;

    // Draft management (includes unsaved changes, keyboard shortcuts, etc.)
    const drafts = useProposalDrafts({
        orgId,
        formData,
        initialFormData: initialProposalFormData,
        setFormData,
        setStep,
        onDraftLoad: (draft) => {
            if (draft.outcomes.length > 0) {
                setSelectedOutcomeId(draft.outcomes[0].id);
            }
        },
    });

    // Outcome management actions
    const onAddAction = useCallback(
        (outcomeId: string, type: ActionType, data: ActionData) => {
            updateField(
                "outcomes",
                formData.outcomes.map((outcome) => {
                    if (outcome.id === outcomeId) {
                        const newAction: ProposalAction = {
                            id: `${outcomeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            type,
                            data,
                        };
                        return {
                            ...outcome,
                            actions: [...outcome.actions, newAction],
                        };
                    }
                    return outcome;
                })
            );
        },
        [formData.outcomes, updateField]
    );

    const onRemoveAction = useCallback(
        (outcomeId: string, actionId: string) => {
            updateField(
                "outcomes",
                formData.outcomes.map((outcome) => {
                    if (outcome.id === outcomeId) {
                        return {
                            ...outcome,
                            actions: outcome.actions.filter((action) => action.id !== actionId),
                        };
                    }
                    return outcome;
                })
            );
        },
        [formData.outcomes, updateField]
    );

    const onUpdateAction = useCallback(
        (outcomeId: string, actionId: string, data: ActionData) => {
            updateField(
                "outcomes",
                formData.outcomes.map((outcome) => {
                    if (outcome.id === outcomeId) {
                        return {
                            ...outcome,
                            actions: outcome.actions.map((action) =>
                                action.id === actionId ? { ...action, data } : action
                            ),
                        };
                    }
                    return outcome;
                })
            );
        },
        [formData.outcomes, updateField]
    );

    const onReorderActions = useCallback(
        (outcomeId: string, actionIds: string[]) => {
            updateField(
                "outcomes",
                formData.outcomes.map((outcome) => {
                    if (outcome.id === outcomeId) {
                        const reorderedActions = actionIds
                            .map((id) => outcome.actions.find((action) => action.id === id))
                            .filter((action): action is ProposalAction => action !== undefined);
                        return {
                            ...outcome,
                            actions: reorderedActions,
                        };
                    }
                    return outcome;
                })
            );
        },
        [formData.outcomes, updateField]
    );

    const onAddOutcome = useCallback(() => {
        const newOutcome: OutcomeData = {
            id: `outcome-${Date.now()}`,
            name: "",
            description: "",
            actions: [],
        };
        let updatedOutcomes = [...formData.outcomes];
        if (formData.outcomes.length === 1) {
            updatedOutcomes = formData.outcomes.map((outcome, index) =>
                index === 0 ? { ...outcome, name: "" } : outcome
            );
        }
        updateField("outcomes", [...updatedOutcomes, newOutcome]);
        setEditingOutcomeId(newOutcome.id);
        setEditingOutcomeName("");
    }, [formData.outcomes, updateField]);

    const onRemoveOutcome = useCallback(
        (outcomeId: string) => {
            if (formData.outcomes.length <= 1) return;
            const newOutcomes = formData.outcomes.filter((o) => o.id !== outcomeId);
            const finalOutcomes =
                newOutcomes.length === 1
                    ? newOutcomes.map((outcome) => ({ ...outcome, name: "Approve" }))
                    : newOutcomes;
            updateField("outcomes", finalOutcomes);
            if (selectedOutcomeId === outcomeId) {
                setSelectedOutcomeId(finalOutcomes[0]?.id || "pass");
            }
            if (editingOutcomeId === outcomeId) {
                setEditingOutcomeId(null);
                setEditingOutcomeName("");
            }
        },
        [formData.outcomes, selectedOutcomeId, editingOutcomeId, updateField]
    );

    const onStartRenameOutcome = useCallback(
        (outcomeId: string, currentName: string) => {
            // Save current edit before starting a new one
            if (editingOutcomeId && editingOutcomeName.trim()) {
                updateField(
                    "outcomes",
                    formData.outcomes.map((outcome) =>
                        outcome.id === editingOutcomeId ? { ...outcome, name: editingOutcomeName } : outcome
                    )
                );
            }
            setEditingOutcomeId(outcomeId);
            setEditingOutcomeName(currentName);
        },
        [editingOutcomeId, editingOutcomeName, formData.outcomes, updateField]
    );

    const onSaveRename = useCallback(() => {
        if (!editingOutcomeName.trim() || !editingOutcomeId) return;
        updateField(
            "outcomes",
            formData.outcomes.map((outcome) =>
                outcome.id === editingOutcomeId ? { ...outcome, name: editingOutcomeName } : outcome
            )
        );
        setEditingOutcomeId(null);
        setEditingOutcomeName("");
    }, [editingOutcomeName, editingOutcomeId, formData.outcomes, updateField]);

    const onCancelRename = useCallback(() => {
        setEditingOutcomeId(null);
        setEditingOutcomeName("");
    }, []);

    const onUpdateOutcomeDescription = useCallback(
        (outcomeId: string, description: string) => {
            updateField(
                "outcomes",
                formData.outcomes.map((outcome) => (outcome.id === outcomeId ? { ...outcome, description } : outcome))
            );
        },
        [formData.outcomes, updateField]
    );

    // Submit success handler
    const handleSubmitSuccess = useCallback(() => {
        setShowSubmitModal(false);
        if (drafts.currentDraftId) {
            drafts.discardDraft(drafts.currentDraftId);
        }
        setFormData(initialProposalFormData);
        setSelectedOutcomeId("pass");
        setStep(0);
    }, [drafts, setFormData, setShowSubmitModal, setStep]);

    return {
        // Form state
        title: formData.title,
        description: formData.description,
        outcomes: formData.outcomes,
        selectedOutcomeId,
        step,

        // UI state
        editingOutcomeId,
        editingOutcomeName,
        showSubmitModal,

        // Setters
        setTitle: (title: string) => updateField("title", title),
        setDescription: (description: string) => updateField("description", description),
        setStep,
        setEditingOutcomeName,
        setShowSubmitModal,

        // Validation
        hasError,
        attemptedSubmit,
        tabCompletionState,
        getTabErrors,

        // Draft management (separate concern)
        drafts,

        // Outcome actions
        onAddAction,
        onRemoveAction,
        onUpdateAction,
        onReorderActions,
        onAddOutcome,
        onRemoveOutcome,
        onStartRenameOutcome,
        onSaveRename,
        onCancelRename,
        onUpdateOutcomeDescription,
        setSelectedOutcomeId,

        // Submit
        onSubmit,
        handleSubmitSuccess,
    };
}
