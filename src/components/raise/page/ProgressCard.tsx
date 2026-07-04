import { useId } from "react";
import { useNavigate } from "react-router";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/inputs/Button";
import { formatNumber } from "@/lib/formatNumber";
import { getTimeRemainingLabel } from "@/lib/getDaysRemaining";
import type { RaiseUiStatus } from "@/lib/raiseStatus";
import type { RaiseView } from "@/types/RaiseView";

interface UserInvestment {
    hasInvested: boolean;
    amount: number;
    percentage: number;
    rank: number;
}

interface ProgressCircleProps {
    progress: number;
    isFunded: boolean;
    isFailed?: boolean;
}

interface ProgressCardProps {
    raise: RaiseView;
    progress: number;
    isFunded: boolean;
    isEnded: boolean;
    status: RaiseUiStatus;
    userInvestment: UserInvestment;
    setIsInvestModalOpen: (isOpen: boolean) => void;
}

function UpcomingRaiseNotice({ raiseStart }: { raiseStart: Date }) {
    const countdown = getTimeRemainingLabel(raiseStart);
    const startsIn = countdown === "Ended" ? "Starting soon" : countdown.replace(/ left$/, "");
    const startsAtLabel = raiseStart.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <div className="w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 shrink-0 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="text-sm font-semibold text-blue-300">Raise opens in {startsIn}</p>
            </div>
            <p className="text-xs text-white/60">Public contributions go live on {startsAtLabel}.</p>
        </div>
    );
}

function ProgressCircle(props: ProgressCircleProps) {
    const { progress, isFunded, isFailed } = props;
    // Generate unique IDs for gradients to avoid conflicts
    const uniqueId = useId();
    const gradientId = `progress-gradient-${uniqueId}`;
    const bgGradientId = `bg-gradient-${uniqueId}`;

    // Color scheme based on status
    const progressColors = isFailed
        ? { start: "#FFFFFF40", end: "#FFFFFF60" } // Muted red for failed
        : { start: "#5FA5FA", end: "#3B82F6" }; // Blue for active/funded

    const bgColors = isFailed
        ? { start: "#1A1212", end: "#000000" } // Subtle dark red-tinted bg for failed
        : { start: "#131F38", end: "#000000" }; // Dark blue-tinted bg for normal

    return (
        <div className="relative">
            <svg className="w-64 h-64 -rotate-90" viewBox="0 0 200 200">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={progressColors.start} />
                        <stop offset="100%" stopColor={progressColors.end} />
                    </linearGradient>
                    <linearGradient id={bgGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={bgColors.start} />
                        <stop offset="100%" stopColor={bgColors.end} />
                    </linearGradient>
                </defs>

                {/* Outer ring - thick solid progress */}
                {/* Background */}
                <circle cx="100" cy="100" r="85" fill={`url(#${bgGradientId})`} stroke="#171B1F" strokeWidth="10" />
                {/* Progress */}
                <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.min(progress, 100) / 100) * 534} 534`}
                    className="transition-all duration-1000 ease-out"
                />

                {/* Inner ring - thin tick marks */}
                {/* Progress tick marks */}
                {Array.from({ length: 160 }).map((_, i) => {
                    const completedTicks = Math.floor(((progress - 100) / 100) * 80);
                    const angle = (i * 4.5 * Math.PI) / 180;
                    const r1 = 65;
                    const r2 = 74;
                    const x1 = 100 + r1 * Math.cos(angle);
                    const y1 = 100 + r1 * Math.sin(angle);
                    const x2 = 100 + r2 * Math.cos(angle);
                    const y2 = 100 + r2 * Math.sin(angle);
                    // Use muted red for failed oversubscription ticks, blue for normal
                    const tickColor = i < completedTicks ? (isFailed ? "#7A3A3A" : "#448AF7") : "#2B2B2D";
                    return (
                        <line
                            key={`tick-prog-${i}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={tickColor}
                            strokeWidth={i < completedTicks ? "2" : "1"}
                            strokeLinecap="round"
                            className="transition-all duration-50"
                        />
                    );
                })}
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                    className={`text-5xl font-bold tracking-tight ${isFailed ? "text-white/50" : isFunded ? "bg-clip-text bg-linear-to-r from-primary to-primary-light text-transparent" : "text-text-secondary"}`}
                >
                    {progress.toFixed(0)}%
                </div>
                <div className="text-sm text-white/40 mt-1">funded</div>
            </div>
        </div>
    );
}

export function ProgressCard({
    raise,
    progress,
    isFunded,
    isEnded,
    status,
    userInvestment,
    setIsInvestModalOpen,
}: ProgressCardProps) {
    const navigate = useNavigate();
    // For completed funded raises, show a different layout
    if (status === "funded") {
        return (
            <Card className="border-success/20 overflow-hidden relative">
                {/* Gradient background glow */}
                <div className="absolute inset-0 bg-linear-to-br from-success/10 via-transparent to-primary/5 pointer-events-none" />

                <CardContent className="flex flex-col gap-4 relative">
                    {/* Hero section with big percentage */}
                    <div className="text-center py-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/20 border border-success/30 mb-3">
                            <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <span className="text-xs font-semibold text-success">Raise Completed</span>
                        </div>
                        <div className="text-5xl font-bold bg-linear-to-r from-success to-emerald-400 bg-clip-text text-transparent">
                            {progress.toFixed(0)}%
                        </div>
                        <p className="text-sm text-white/50 mt-1">funded</p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white/5">
                            <p className="text-xs text-white/50">Raised</p>
                            <p className="text-sm font-semibold">${formatNumber(raise.raised)}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/5">
                            <p className="text-xs text-white/50">{raise.maxRaise !== null ? "Goal" : "Min Goal"}</p>
                            <p className="text-sm font-semibold">${formatNumber(raise.maxRaise ?? raise.raising)}</p>
                        </div>
                        {raise.maxRaise !== null && (
                            <div className="text-center p-2 rounded-lg bg-white/5">
                                <p className="text-xs text-white/50">Min</p>
                                <p className="text-sm font-semibold">${formatNumber(raise.raising)}</p>
                            </div>
                        )}
                        <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-xs text-white/50">Accepted</p>
                            <p className="text-sm font-semibold text-primary">
                                ${formatNumber(raise.accepted ?? raise.raised)}
                            </p>
                        </div>
                    </div>

                    {/* CTA */}
                    {raise.orgId && (
                        <button
                            onClick={() => navigate(`/orgs/${raise.orgId}`)}
                            className="flex items-center justify-between pt-2 text-white/50 hover:text-white/80 transition-colors group"
                        >
                            <span className="text-sm">View {raise.name} Organization</span>
                            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/80 transition-all group-hover:translate-x-1" />
                        </button>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-white/10 overflow-hidden">
            <CardContent className=" flex flex-col items-center justify-center gap-3">
                {/* Circular Progress */}
                <ProgressCircle progress={progress} isFunded={isFunded} isFailed={status === "failed"} />

                {/* Stats */}
                <div className="text-center space-y-1">
                    <p className="text-2xl font-semibold tracking-tight">${formatNumber(raise.raised)}</p>
                    <p className="text-sm text-white/40">
                        raised of {raise.maxRaise === null ? "min " : ""}$
                        {formatNumber(raise.maxRaise ?? raise.raising)} goal
                    </p>
                    {raise.maxRaise !== null && (
                        <p className="text-xs text-white/30">Min: ${formatNumber(raise.raising)}</p>
                    )}
                    {raise.pendingReserved > 0 && raise.maxRaise !== null && (
                        <p className="text-xs text-amber-400/70">
                            ${formatNumber(raise.pendingReserved)} reserved
                            {" \u00B7 "}$
                            {formatNumber(Math.max(raise.maxRaise - raise.pendingReserved - raise.raised, 0))} open
                        </p>
                    )}
                </div>

                {!isEnded && (
                    <Button
                        className="w-full font-medium"
                        disabled={status !== "active"}
                        onClick={() => status === "active" && setIsInvestModalOpen(true)}
                    >
                        {status === "active" ? "Invest" : "Coming Soon"}
                    </Button>
                )}

                {/* Status Messages */}
                {status === "active" && isFunded && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20 w-full">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="font-medium">Goal reached</span>
                    </div>
                )}
                {status === "upcoming" && <UpcomingRaiseNotice raiseStart={raise.raiseStart} />}
                {status === "finalizing" && (
                    <div className="w-full p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 shrink-0">
                                <svg className="animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-blue-300">Finalizing Onchain</p>
                        </div>
                        <p className="text-xs text-white/60">
                            The raise has closed and onchain actions are being executed. This typically completes within
                            a few minutes.
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                <div
                                    className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse"
                                    style={{ animationDelay: "0.2s" }}
                                />
                                <div
                                    className="w-1.5 h-1.5 rounded-full bg-blue-400/30 animate-pulse"
                                    style={{ animationDelay: "0.4s" }}
                                />
                            </div>
                            <p className="text-xs text-white/40">Processing completion intents</p>
                        </div>
                    </div>
                )}
                {status === "failed" && (
                    <div className="w-full p-3 rounded-lg bg-error/10 border border-error/30">
                        <div className="flex items-start gap-2">
                            <svg
                                className="w-4 h-4 shrink-0 text-error mt-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-error">Goal not reached</p>
                                {userInvestment.hasInvested && (
                                    <p className="text-xs text-white/60 mt-1">Your funds are available for refund</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
