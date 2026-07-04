import { useState, useMemo } from "react";
import { Modal } from "@/components/overlays/Modal";
import { formatNumber } from "@/lib/formatNumber";

interface ShareDistributionChartProps {
    contributors: { address: string; amount: number; percentage: number }[];
}

function ShareDistributionChart({ contributors }: ShareDistributionChartProps) {
    // Top investors for pie chart (top 5 + others)
    const topInvestorsData = contributors.slice(0, 5);
    const othersPercentage = 100 - topInvestorsData.reduce((sum, inv) => sum + inv.percentage, 0);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Share Distribution</h3>
            <div className="flex items-center justify-center">
                <svg className="w-48 h-48 sm:w-64 sm:h-64 -rotate-90" viewBox="0 0 200 200">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    {(() => {
                        let currentAngle = 0;
                        const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6B7280"];
                        const investors = [...topInvestorsData, { address: "Others", percentage: othersPercentage }];

                        return investors.map((investor, index) => {
                            const percentage = investor.percentage;
                            const angle = (percentage / 100) * 360;
                            const outerRadius = 90;
                            const innerRadius = 55;
                            const x = 100;
                            const y = 100;

                            const startAngle = currentAngle;
                            const endAngle = currentAngle + angle;
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;

                            const x1 = x + innerRadius * Math.cos(startRad);
                            const y1 = y + innerRadius * Math.sin(startRad);
                            const x2 = x + outerRadius * Math.cos(startRad);
                            const y2 = y + outerRadius * Math.sin(startRad);
                            const x3 = x + outerRadius * Math.cos(endRad);
                            const y3 = y + outerRadius * Math.sin(endRad);
                            const x4 = x + innerRadius * Math.cos(endRad);
                            const y4 = y + innerRadius * Math.sin(endRad);

                            const largeArc = angle > 180 ? 1 : 0;
                            const path = `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`;

                            currentAngle += angle;

                            return (
                                <path
                                    key={index}
                                    d={path}
                                    fill={colors[index]}
                                    stroke="rgba(0,0,0,0.3)"
                                    strokeWidth="1"
                                    filter="url(#glow)"
                                    className="transition-opacity duration-200 hover:opacity-80"
                                />
                            );
                        });
                    })()}
                </svg>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...topInvestorsData, { address: "Others", percentage: othersPercentage }].map((investor, index) => {
                    const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6B7280"];
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm px-2 py-1.5">
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: colors[index] }} />
                            <span className="text-white/60 font-mono text-xs truncate">{investor.address}</span>
                            <span className="ml-auto text-white/80 font-medium tabular-nums text-xs shrink-0">
                                {investor.percentage.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface DistributionBySizeChartProps {
    investorTiers: { label: string; count: number; amount: number; color: string }[];
    totalRaised: number;
}

function DistributionBySizeChart({ investorTiers, totalRaised }: DistributionBySizeChartProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Distribution by Size</h3>
            <div className="flex items-center justify-center">
                <svg className="w-48 h-48 sm:w-64 sm:h-64 -rotate-90" viewBox="0 0 200 200">
                    <defs>
                        <filter id="glow2">
                            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    {(() => {
                        let currentAngle = 0;

                        return investorTiers.map((tier, index) => {
                            const percentage = totalRaised > 0 ? (tier.amount / totalRaised) * 100 : 0;
                            const angle = (percentage / 100) * 360;
                            const outerRadius = 90;
                            const innerRadius = 55;
                            const x = 100;
                            const y = 100;

                            const startAngle = currentAngle;
                            const endAngle = currentAngle + angle;
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;

                            const x1 = x + innerRadius * Math.cos(startRad);
                            const y1 = y + innerRadius * Math.sin(startRad);
                            const x2 = x + outerRadius * Math.cos(startRad);
                            const y2 = y + outerRadius * Math.sin(startRad);
                            const x3 = x + outerRadius * Math.cos(endRad);
                            const y3 = y + outerRadius * Math.sin(endRad);
                            const x4 = x + innerRadius * Math.cos(endRad);
                            const y4 = y + innerRadius * Math.sin(endRad);

                            const largeArc = angle > 180 ? 1 : 0;
                            const path = `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`;

                            currentAngle += angle;

                            return (
                                <path
                                    key={index}
                                    d={path}
                                    fill={tier.color}
                                    stroke="rgba(0,0,0,0.3)"
                                    strokeWidth="1"
                                    filter="url(#glow2)"
                                    className="transition-opacity duration-200 hover:opacity-80"
                                />
                            );
                        });
                    })()}
                </svg>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {investorTiers.map((tier, index) => {
                    const percentage = (tier.amount / totalRaised) * 100;
                    return (
                        <div key={index} className="flex items-start gap-2 px-2 py-1.5">
                            <div
                                className="w-3 h-3 rounded-sm mt-0.5 shrink-0"
                                style={{ backgroundColor: tier.color }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-white/70 text-xs font-medium">{tier.label}</div>
                                <div className="text-white/40 text-[10px] tabular-nums">
                                    {formatNumber(tier.count)} investors
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-white/80 font-semibold text-xs tabular-nums">
                                    {percentage.toFixed(1)}%
                                </div>
                                <div className="text-white/40 text-[10px] tabular-nums">
                                    ${formatNumber(tier.amount)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface Props {
    contributors: { address: string; amount: number; percentage: number }[];
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export function InvestorsModal({ contributors, isOpen, setIsOpen }: Props) {
    const [activeChartTab, setActiveChartTab] = useState<"share" | "size">("share");

    const investorTiers = useMemo(() => {
        const tierDefs = [
            { label: "Small (<$1K)", min: 0, max: 1_000, color: "#F59E0B" },
            { label: "Medium ($1K-$10K)", min: 1_000, max: 10_000, color: "#10B981" },
            { label: "Large ($10K-$100K)", min: 10_000, max: 100_000, color: "#3B82F6" },
            { label: "Whale (>$100K)", min: 100_000, max: Infinity, color: "#8B5CF6" },
        ];
        return tierDefs
            .map((def) => {
                const matching = contributors.filter((c) => c.amount >= def.min && c.amount < def.max);
                return {
                    label: def.label,
                    count: matching.length,
                    amount: matching.reduce((sum, c) => sum + c.amount, 0),
                    color: def.color,
                };
            })
            .filter((tier) => tier.count > 0);
    }, [contributors]);

    const totalRaised = investorTiers.reduce((sum, tier) => sum + tier.amount, 0);

    if (contributors.length === 0) {
        return (
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Investors" className="w-full max-w-6xl">
                <p className="text-text-muted text-sm py-8 text-center">No investor data available</p>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Investors"
            subTitle={`${contributors.length} total investors`}
            className="w-full max-w-6xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-4">
                {/* Left: Top Investors List */}
                <div className="lg:col-span-1 space-y-3 min-h-0">
                    <h3 className="text-lg font-semibold">Top Investors</h3>
                    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "min(400px, 50vh)" }}>
                        {contributors.map((contributor, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-colors border border-white/5"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-white/40 text-xs w-6 shrink-0">#{index + 1}</span>
                                    <span className="text-sm font-mono text-white/70 truncate">
                                        {contributor.address}
                                    </span>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className="text-sm font-semibold">${formatNumber(contributor.amount)}</div>
                                    <div className="text-xs text-white/40">{contributor.percentage}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Visualizations */}
                <div className="lg:col-span-2 space-y-4 min-h-0">
                    {/* Chart Tabs */}
                    <div className="flex gap-1 border-b border-white/10 overflow-x-auto shrink-0">
                        <button
                            onClick={() => setActiveChartTab("share")}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                                activeChartTab === "share"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-white/40 hover:text-white/60"
                            }`}
                        >
                            Share Distribution
                        </button>
                        <button
                            onClick={() => setActiveChartTab("size")}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                                activeChartTab === "size"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-white/40 hover:text-white/60"
                            }`}
                        >
                            Distribution by Size
                        </button>
                    </div>

                    {/* Share Distribution Chart */}
                    {activeChartTab === "share" && <ShareDistributionChart contributors={contributors} />}

                    {/* Distribution by Size Chart */}
                    {activeChartTab === "size" && (
                        <DistributionBySizeChart investorTiers={investorTiers} totalRaised={totalRaised} />
                    )}
                </div>
            </div>
        </Modal>
    );
}
