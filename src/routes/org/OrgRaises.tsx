import { Helmet } from "react-helmet-async";
import { File, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { NotFound } from "@/components/navigation/NotFound";
import { RaiseCard } from "@/components/raise/Card";
import { useDAO, useRaises } from "@/hooks/api";
import { getRaiseUiStatus } from "@/lib/raiseStatus";
import { toDAODisplay } from "@/types";
import { toRaiseView, type RaiseView } from "@/types/RaiseView";

interface RaiseSectionProps {
    title: string;
    count: number;
    emptyText: string;
    orgPath: string;
    raises: RaiseView[];
}

function RaiseSection({ title, count, emptyText, orgPath, raises }: RaiseSectionProps) {
    return (
        <section className="flex flex-col gap-3 sm:gap-4">
            <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-lg font-semibold">{title}</h2>
                <span className="text-sm text-text-muted">{count}</span>
            </div>

            {raises.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {raises.map((raise) => (
                        <RaiseCard
                            key={raise.id}
                            raise={raise}
                            detailPath={`${orgPath}/raises/${raise.id}`}
                            orgPath={orgPath}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-border-light bg-white/[0.025] px-4 py-8 text-center">
                    <File className="mb-3 h-8 w-8 text-text-disabled" />
                    <p className="text-sm text-text-muted">{emptyText}</p>
                </div>
            )}
        </section>
    );
}

export function OrgRaises() {
    const { orgId } = useParams<{ orgId: string }>();
    const { data: daoRaw, isLoading: daoLoading, error: daoError } = useDAO(orgId);

    const dao = useMemo(() => (daoRaw ? toDAODisplay(daoRaw) : undefined), [daoRaw]);
    const orgPath = `/orgs/${orgId}`;
    const effectiveOrgId = daoRaw?.id ?? orgId;
    const { data: apiRaises, isLoading: raisesLoading } = useRaises(effectiveOrgId, {
        enabled: Boolean(effectiveOrgId) && !daoLoading && !daoError,
    });

    const raises = useMemo(() => (apiRaises ?? []).map(toRaiseView), [apiRaises]);

    const currentRaises = raises.filter((raise) => {
        const status = getRaiseUiStatus(raise._raw);
        return status === "upcoming" || status === "active" || status === "finalizing";
    });
    const historicalRaises = raises.filter((raise) => {
        const status = getRaiseUiStatus(raise._raw);
        return status === "funded" || status === "failed";
    });

    if (daoLoading || raisesLoading) {
        return (
            <div className="route-container flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (daoError || !dao || !daoRaw) {
        return <NotFound name="Organization" />;
    }

    return (
        <div className="route-container flex flex-col gap-4">
            <Helmet>
                <title>{dao.name} Raises</title>
            </Helmet>
            <Breadcrumbs
                items={[
                    { label: "Home", href: "/" },
                    { label: "Orgs", href: "/orgs" },
                    { label: dao.name, href: orgPath },
                    { label: "Raises" },
                ]}
            />

            <div className="flex flex-col gap-1">
                <h1>Raises</h1>
                <p className="max-w-2xl text-sm text-text-muted">
                    Current and historical raises connected to {dao.name}.
                </p>
            </div>

            <div className="flex flex-col gap-6">
                <RaiseSection
                    title="Current"
                    count={currentRaises.length}
                    emptyText="No current raises for this org."
                    orgPath={orgPath}
                    raises={currentRaises}
                />
                <RaiseSection
                    title="Historical"
                    count={historicalRaises.length}
                    emptyText="No historical raises for this org yet."
                    orgPath={orgPath}
                    raises={historicalRaises}
                />
            </div>
        </div>
    );
}
