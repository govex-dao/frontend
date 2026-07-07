import { Helmet } from "react-helmet-async";
import { BarChart3, Building2, Loader2, Shield } from "lucide-react";
import type { ReactNode } from "react";
import { useStats } from "@/hooks/api";

function formatCount(value: number | undefined): string {
    if (value === undefined) return "--";
    return new Intl.NumberFormat("en-US").format(value);
}

function MetricCard({
    label,
    value,
    isLoading,
    icon,
}: {
    label: string;
    value: number | undefined;
    isLoading: boolean;
    icon: ReactNode;
}) {
    return (
        <div className="glass-flow-panel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
                    <div className="mt-3 min-h-10">
                        {isLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        ) : (
                            <p className="text-4xl font-semibold text-text-primary">{formatCount(value)}</p>
                        )}
                    </div>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                    {icon}
                </div>
            </div>
        </div>
    );
}

export function GovexDashboard() {
    const { data: stats, isLoading, isError } = useStats();

    return (
        <div className="route-container flex h-full flex-col gap-4 pt-4 pb-8 sm:pt-6 lg:pt-8">
            <Helmet>
                <title>Govex Dashboard</title>
            </Helmet>

            <section className="glass-flow-panel rounded-xl p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Govex Dashboard</h1>
                    <p className="max-w-2xl text-sm text-text-muted">
                        Internal product counts from the public backend.
                    </p>
                </div>

                {isError && (
                    <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        Failed to load dashboard stats.
                    </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricCard
                        label="Multisigs"
                        value={stats?.multisig_count}
                        isLoading={isLoading}
                        icon={<Shield className="h-5 w-5" />}
                    />
                    <MetricCard
                        label="Orgs"
                        value={stats?.dao_count}
                        isLoading={isLoading}
                        icon={<Building2 className="h-5 w-5" />}
                    />
                    <MetricCard
                        label="Decision markets"
                        value={stats?.proposal_count}
                        isLoading={isLoading}
                        icon={<BarChart3 className="h-5 w-5" />}
                    />
                </div>
            </section>
        </div>
    );
}
