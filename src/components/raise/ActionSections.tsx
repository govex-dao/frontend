import { ActionCard } from "@/components/proposal/actions/Card";
import { indexedActionsToProposalActions, type IndexedActionContext } from "@/lib/indexedActions";

interface ActionSectionInput {
    title: string;
    caption?: string;
    actions: unknown;
}

interface Props {
    title?: string;
    sections: ActionSectionInput[];
    context?: IndexedActionContext;
}

export function RaiseActionSections({ title = "Onchain actions", sections, context }: Props) {
    const renderedSections = sections
        .map((section, index) => ({
            ...section,
            actions: indexedActionsToProposalActions(section.actions, `${section.title}-${index}`, context),
        }))
        .filter((section) => section.actions.length > 0);

    if (renderedSections.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm text-text-muted">Actions staged with this account flow.</p>
            </div>

            {renderedSections.map((section) => (
                <section key={section.title} className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                        <h4 className="text-sm font-semibold text-text-primary">{section.title}</h4>
                        <span className="text-xs text-text-muted">{section.actions.length}</span>
                        {section.caption && <span className="text-xs text-text-muted">{section.caption}</span>}
                    </div>
                    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                        {section.actions.map((action, actionIndex) => (
                            <ActionCard key={action.id} number={actionIndex + 1} action={action} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
