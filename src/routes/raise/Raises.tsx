import { Helmet } from "react-helmet-async";
import { File, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { RaiseCard } from "@/components/raise/Card";
import { useRaises } from "@/hooks/api/useRaises";
import { toRaiseView, type RaiseView } from "@/types/RaiseView";
import { getRaiseUiStatus } from "@/lib/raiseStatus";

interface SectionProps {
    title: string;
    count: number;
    raises: RaiseView[];
}

function Section(props: SectionProps) {
    const { title, count, raises } = props;
    if (raises.length === 0) return null;

    return (
        <section className="flex flex-col gap-2 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 justify-between">
                <div className="flex flex-row items-baseline gap-2 sm:gap-3">
                    <h4>{title}</h4>
                    <p className="text-text-light">{count}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {raises.map((raise) => {
                    return <RaiseCard key={raise.id} raise={raise} />;
                })}
            </div>
        </section>
    );
}

export function Raises() {
    const { data: apiRaises, isLoading } = useRaises();

    // Convert API raises to view models
    const raises = apiRaises?.map(toRaiseView) ?? [];

    // Separate raises by status
    const activeRaises = raises.filter((raise) => getRaiseUiStatus(raise._raw) === "active");
    const upcomingRaises = raises.filter((raise) => getRaiseUiStatus(raise._raw) === "upcoming");
    const completedRaises = raises.filter((raise) => {
        const status = getRaiseUiStatus(raise._raw);
        return status === "funded" || status === "failed" || status === "finalizing";
    });

    if (isLoading) {
        return (
            <div className="route-container flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="route-container gap-2 h-full mb-8">
            <Helmet>
                <title>Raises</title>
            </Helmet>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Raises" }]} />

            {/* Header */}
            <div className="mb-4">
                <h1>Raises</h1>
            </div>

            <div className="flex flex-col gap-6 sm:gap-16">
                {/* Active Fundraises */}
                <Section title="Active Raises" count={activeRaises.length} raises={activeRaises} />

                {/* Upcoming Fundraises */}
                <Section title="Upcoming Raises" count={upcomingRaises.length} raises={upcomingRaises} />

                {/* Past Fundraises */}
                <Section title="Past Raises" count={completedRaises.length} raises={completedRaises} />
            </div>

            {/* Empty State */}
            {activeRaises.length === 0 && upcomingRaises.length === 0 && completedRaises.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <File className="w-10 h-10 text-text-disabled" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xl font-semibold text-text-primary">No Raises Available</h3>
                        <p className="text-text-muted text-center max-w-md">
                            There are currently no active raises. Check back soon.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
