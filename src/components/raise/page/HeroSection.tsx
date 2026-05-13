import { Globe, MessageCircle, Twitter } from "lucide-react";
import { ExternalLinkButton } from "@/components/ExternalLinkButton";
import { LiveChip } from "@/components/badges/LiveChip";
import { Badge } from "@/components/Badge";
import type { RaiseView } from "@/types/RaiseView";
import type { RaiseUiStatus } from "@/lib/raiseStatus";

interface Props {
    raise: RaiseView;
    status: RaiseUiStatus;
    isFunded: boolean;
}

export function HeroSection(props: Props) {
    const { raise, status, isFunded } = props;
    if (!raise.headerImage) return null;

    return (
        <div className="h-80 sm:h-72 md:h-80 relative overflow-hidden rounded-2xl backdrop-blur-sm border border-border-light">
            <div className="absolute inset-0">
                <img
                    src={raise.headerImage}
                    alt={`${raise.name} header`}
                    className="w-full h-full object-cover opacity-60"
                />
            </div>
            <div className="absolute inset-0 bg-linear-to-t from-[#0A0B0B] via-black/50 to-transparent" />

            {/* Content Overlay */}
            <div className="relative flex flex-col p-4 sm:p-6 h-full gap-3 sm:gap-4 justify-between">
                {/* Social Links */}
                {(raise.website || raise.twitter || raise.discord) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {raise.website && <ExternalLinkButton href={raise.website} icon={Globe} label="Website" />}
                        {raise.twitter && <ExternalLinkButton href={raise.twitter} icon={Twitter} label="Twitter" />}
                        {raise.discord && (
                            <ExternalLinkButton href={raise.discord} icon={MessageCircle} label="Discord" />
                        )}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
                    {/* Icon */}
                    <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xl overflow-hidden ${
                            raise.image
                                ? ""
                                : "bg-linear-to-br from-primary/20 to-primary/5 backdrop-blur-xl border border-primary/30"
                        }`}
                    >
                        {raise.image ? (
                            <img src={raise.image} alt={raise.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-2xl sm:text-3xl md:text-4xl font-semibold text-primary">
                                {raise.name[0]}
                            </div>
                        )}
                    </div>

                    {/* Title and Status */}
                    <div className="flex-1 w-full sm:w-auto min-w-0 pb-1 sm:pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                            {status === "funded" && isFunded && raise.orgId ? (
                                <a
                                    href={`/orgs/${raise.orgId}`}
                                    className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight wrap-break-word hover:text-primary transition-colors"
                                >
                                    {raise.name}
                                </a>
                            ) : (
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight wrap-break-word">
                                    {raise.name}
                                </h1>
                            )}
                            {status === "active" ? (
                                <LiveChip color="green" animated />
                            ) : status === "funded" ? (
                                <Badge variant="green">Funded</Badge>
                            ) : status === "finalizing" ? (
                                <Badge variant="blue">Finalizing</Badge>
                            ) : status === "failed" ? (
                                <Badge variant="red">Failed</Badge>
                            ) : (
                                <Badge variant="blue">Upcoming</Badge>
                            )}
                        </div>
                        <p className="text-white/60 text-sm md:text-base line-clamp-3 sm:line-clamp-none">
                            {raise.description}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
