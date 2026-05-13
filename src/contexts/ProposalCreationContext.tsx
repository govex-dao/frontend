import { createContext, useContext, type ReactNode } from "react";
import { useProposalCreation } from "@/hooks/forms/useProposalCreation";

type ProposalCreationContextType = ReturnType<typeof useProposalCreation>;

const ProposalCreationContext = createContext<ProposalCreationContextType | null>(null);

export function ProposalCreationProvider({ children, orgId }: { children: ReactNode; orgId: string }) {
    const proposalCreation = useProposalCreation(orgId);

    return <ProposalCreationContext.Provider value={proposalCreation}>{children}</ProposalCreationContext.Provider>;
}

export function useProposalCreationContext() {
    const context = useContext(ProposalCreationContext);
    if (!context) {
        throw new Error("useProposalCreationContext must be used within ProposalCreationProvider");
    }
    return context;
}
