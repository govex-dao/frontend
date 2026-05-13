import { useState, useCallback } from "react";
import { showValidationErrors } from "@/lib/formValidationUtils";

export interface ValidationRule {
    required: boolean;
    label: string;
    step: number;
}

export interface ValidationRules {
    [key: string]: ValidationRule;
}

export type Validations<TFormData> = {
    [K in keyof TFormData]: ValidationRule;
};

export interface ValidationError {
    field: string;
    step: number;
    message: string;
}

export interface AdditionalValidation {
    isValid: boolean;
    errors: string[];
}

export interface UseFormValidationOptions<TFormData, TRules extends ValidationRules> {
    /**
     * Initial form data
     */
    initialFormData: TFormData;
    /**
     * Validation rules for form fields
     */
    validationRules: TRules;
    /**
     * Optional additional validation function (e.g., for outcomes, complex fields)
     */
    additionalValidation?: (formData: TFormData) => AdditionalValidation;
    /**
     * Function to calculate tab completion state
     */
    getTabCompletionState?: (formData: TFormData, attemptedSubmit: boolean) => boolean[];
    /**
     * Called when form is valid and ready to submit
     */
    onValidSubmit?: () => void;
}

export function useFormValidation<TFormData, TRules extends ValidationRules>(
    options: UseFormValidationOptions<TFormData, TRules>
) {
    const { initialFormData, validationRules, additionalValidation, getTabCompletionState, onValidSubmit } = options;

    // Form state
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState<TFormData>(initialFormData);
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);

    // Update field helper
    const updateField = useCallback(<K extends keyof TFormData>(field: K, value: TFormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }, []);

    // Check if a specific field has an error
    const hasError = (fieldName: keyof TRules): boolean => {
        const rule = validationRules[fieldName];
        const value = formData[fieldName as keyof TFormData];
        return attemptedSubmit && rule.required && typeof value !== "boolean" && !value?.toString().trim();
    };

    // Get all validation errors
    const getValidationErrors = (): ValidationError[] => {
        const errors: ValidationError[] = [];

        Object.entries(validationRules).forEach(([fieldName, rule]) => {
            if (rule.required) {
                const value = formData[fieldName as keyof TFormData];
                if (typeof value !== "boolean" && !value?.toString().trim()) {
                    errors.push({
                        field: rule.label,
                        step: rule.step,
                        message: `${rule.label} is required`,
                    });
                }
            }
        });

        return errors;
    };

    // Validate and return whether the form is valid
    const validate = (): boolean => {
        setAttemptedSubmit(true);
        const errors = getValidationErrors();
        return errors.length === 0;
    };

    // Calculate tab completion state
    const tabCompletionState = getTabCompletionState ? getTabCompletionState(formData, attemptedSubmit) : [];

    // Get tab errors
    const getTabErrors = useCallback((): Record<number, boolean> => {
        if (!attemptedSubmit || !getTabCompletionState) return {};
        const completionState = getTabCompletionState(formData, attemptedSubmit);
        const errors: Record<number, boolean> = {};
        completionState.forEach((isComplete, index) => {
            if (!isComplete) errors[index] = true;
        });
        return errors;
    }, [attemptedSubmit, formData, getTabCompletionState]);

    // Reset validation state
    const resetValidation = () => {
        setAttemptedSubmit(false);
    };

    // Handle form submission with validation
    const onSubmit = useCallback(() => {
        const isFormValid = validate();
        const formErrors = getValidationErrors();
        let allErrors = formErrors.map((e) => e.message);

        // Run additional validation if provided
        let additionalValid = true;
        if (additionalValidation) {
            const additionalResult = additionalValidation(formData);
            additionalValid = additionalResult.isValid;
            allErrors = [...allErrors, ...additionalResult.errors];
        }

        // Show errors if validation failed
        if (!isFormValid || !additionalValid) {
            showValidationErrors(allErrors);
            return;
        }

        // Call onValidSubmit if provided
        if (onValidSubmit) {
            onValidSubmit();
        }

        // Open submit modal
        setShowSubmitModal(true);
    }, [additionalValidation, onValidSubmit, formData]);

    // Submit success handler
    const handleSubmitSuccess = useCallback(() => {
        setShowSubmitModal(false);
        setFormData(initialFormData);
        setStep(0);
    }, [initialFormData]);

    return {
        // Form state
        step,
        formData,
        showSubmitModal,

        // Setters
        setStep,
        setFormData,
        updateField,
        setShowSubmitModal,

        // Validation
        hasError,
        attemptedSubmit,
        tabCompletionState,
        getTabErrors,

        // Submit
        onSubmit,
        handleSubmitSuccess,

        // Advanced (for backwards compatibility)
        getValidationErrors,
        validate,
        resetValidation,
    };
}
