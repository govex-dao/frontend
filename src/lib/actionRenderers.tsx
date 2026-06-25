import type { ReactNode } from "react";
import type { ProposalAction } from "@/types";
import { ExplorerLink } from "@/components/ExplorerLink";
import { decodeActionParams, type DecodedActionParam } from "@/lib/actionParams";
import { formatNumberWithCommas } from "@/lib/formatNumber";
import { formatUnits } from "@/lib/units";

type DisplayParam = DecodedActionParam;

function extractShortMoveType(type: string | undefined): string {
    if (!type) return "";
    const withoutTypeArgs = type.split("<")[0] || type;
    const parts = withoutTypeArgs.split("::");
    return parts[parts.length - 1] || withoutTypeArgs;
}

function formatMoveIdentifier(value: string | undefined): string {
    const short = extractShortMoveType(value) || value || "Action";
    return short
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b(dao|lp|v2|v3|usdc|govex|id)\b/gi, (match) => match.toUpperCase());
}

function getActionDisplayName(action: ProposalAction): string {
    return (
        action.data.displayName ||
        formatMoveIdentifier(action.data.actionType || action.data.fullType) ||
        action.type ||
        "Action"
    );
}

function extractCoinSymbol(coinType: string | undefined): string | undefined {
    if (!coinType) return undefined;
    const short = extractShortMoveType(coinType);
    return short || undefined;
}

function getCoinDisplay(action: ProposalAction) {
    const coinType = action.data.coinType;
    return {
        coinType,
        symbol: action.data.coinSymbol || action.data.token || extractCoinSymbol(coinType),
        decimals: action.data.coinDecimals,
    };
}

function parseIntegerValue(value: string | undefined): bigint | null {
    if (!value) return null;
    const normalized = value.trim().replace(/,/g, "");
    if (!/^-?\d+$/.test(normalized)) return null;
    try {
        return BigInt(normalized);
    } catch {
        return null;
    }
}

function formatIntegerString(value: bigint): string {
    const raw = value.toString();
    const sign = raw.startsWith("-") ? "-" : "";
    const digits = sign ? raw.slice(1) : raw;
    return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function isTokenAmountParam(action: ProposalAction, name: string): boolean {
    const actionName = extractShortMoveType(action.data.actionType || action.data.fullType);
    const normalized = name.toLowerCase();
    if (actionName === "VaultSpend") return normalized === "amount";
    if (actionName === "CreateStream") return normalized === "amountperiteration";
    if (actionName === "CollectStream") return normalized === "amount";
    return false;
}

function formattedTokenAmount(value: string, action: ProposalAction) {
    const raw = parseIntegerValue(value);
    if (raw == null) return null;

    const coin = getCoinDisplay(action);
    const rawDisplay = formatIntegerString(raw);
    if (coin.decimals != null && coin.decimals >= 0) {
        const display = formatUnits(raw, coin.decimals, {
            maxFractionDigits: Math.min(coin.decimals, 6),
        });
        return {
            display: `${display}${coin.symbol ? ` ${coin.symbol}` : ""}`,
            rawDisplay,
            hasUnitConversion: true,
        };
    }

    return {
        display: `${rawDisplay} raw units`,
        rawDisplay,
        hasUnitConversion: false,
    };
}

function getActionParams(action: ProposalAction): {
    decoded: ReturnType<typeof decodeActionParams>;
    params: DisplayParam[];
} {
    const decoded = decodeActionParams(action.data);
    const legacyParams = action.data.params ?? [];
    return {
        decoded,
        params: decoded && decoded.params.length > 0 ? decoded.params : legacyParams,
    };
}

function findParam(params: DisplayParam[], names: string[]): DisplayParam | undefined {
    const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
    return params.find((param) => normalizedNames.has(param.name.toLowerCase()));
}

function formatParamLabel(name: string): string {
    const overrides: Record<string, string> = {
        amountPerIteration: "Amount per iteration",
        ammTotalFeeBps: "AMM total fee",
        capPpm: "Cap",
        claimWindowMs: "Spend window",
        daoName: "DAO name",
        expiryMs: "Expiry",
        iconUrl: "Icon URL",
        iterationPeriodMs: "Iteration period",
        iterationsTotal: "Iterations",
        minAssetAmount: "Minimum asset amount",
        minStableAmount: "Minimum stable amount",
        reviewPeriodMs: "Review period",
        resourceName: "Resource name",
        sponsoredThreshold: "Sponsored threshold",
        startDelay: "Start delay",
        startTime: "Start time",
        tradingPeriodMs: "Trading period",
        vaultName: "Vault",
        whitelistedRecipients: "Whitelisted recipients",
    };
    return overrides[name] || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}

function shortenAddress(value: string): string {
    return value.length > 18 && value.startsWith("0x") ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export const getActionSummary = (action: ProposalAction) => {
    switch (action.type) {
        case "memo":
            return (
                <div
                    className="max-h-[60px] overflow-y-auto overflow-x-hidden pr-2 break-words"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
                        wordBreak: "break-word",
                        overflowWrap: "break-word",
                    }}
                >
                    {action.data.message || "No message provided"}
                </div>
            );
        case "config": {
            const updateCount = action.data.configUpdates?.length || 0;
            if (updateCount === 0) {
                return "No config updates";
            }
            return (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>Update</span>
                    <span className="px-1.5 py-0.5 bg-black/40 rounded font-semibold">
                        {updateCount} {updateCount === 1 ? "parameter" : "parameters"}
                    </span>
                    <span>in {action.data.configUpdates?.[0]?.category}</span>
                </span>
            );
        }
        case "transfer":
            return (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>Transfer</span>
                    <span className="px-1.5 py-0.5 bg-black/40 rounded text-text-primary font-semibold font-mono">
                        {formatNumberWithCommas(Number(action.data.amount))} {action.data.token}
                    </span>
                </span>
            );
        case "createStream":
            return (
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>Create spending limit of</span>
                    <span className="px-1.5 py-0.5 bg-black/40 rounded text-text-primary font-semibold font-mono">
                        {formatNumberWithCommas(Number(action.data.amount))} {action.data.token}
                    </span>
                </span>
            );
        case "onChain": {
            const { params } = getActionParams(action);
            const amountParam = params.find((param) => isTokenAmountParam(action, param.name));
            const amount = amountParam?.value ? formattedTokenAmount(amountParam.value, action) : null;
            const coin = getCoinDisplay(action);
            const vault = findParam(params, ["vaultName"]);
            const recipient = findParam(params, ["recipient", "beneficiary"]);
            const resource = findParam(params, ["resourceName"]);
            const spendAll = findParam(params, ["spendAll"]);
            const secondary = [
                vault?.value ? `Vault ${vault.value}` : null,
                recipient?.value ? `Recipient ${shortenAddress(recipient.value)}` : null,
                resource?.value ? `Resource ${resource.value}` : null,
            ].filter((value): value is string => Boolean(value));

            return (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {amount ? (
                            <>
                                <span>{amountParam?.name === "amountPerIteration" ? "Per iteration" : "Amount"}</span>
                                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs font-semibold text-text-primary">
                                    {amount.display}
                                </span>
                            </>
                        ) : (
                            <span>{getActionDisplayName(action)}</span>
                        )}
                        {spendAll?.value === "true" && (
                            <span className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-text-secondary">
                                spend all
                            </span>
                        )}
                        {!amount && coin.symbol && (
                            <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-text-primary">
                                {coin.symbol}
                            </span>
                        )}
                    </div>
                    {secondary.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 text-xs text-text-tertiary">
                            {secondary.map((item) => (
                                <span key={item} className="rounded border border-border/50 px-1.5 py-0.5">
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
    }
};

const calculateDiff = (current: string, newVal: string): string | null => {
    const currentNum = parseFloat(current.replace(/,/g, ""));
    const newNum = parseFloat(newVal.replace(/,/g, ""));

    if (isNaN(currentNum) || isNaN(newNum)) return null;

    const diff = newNum - currentNum;
    if (currentNum === 0) return diff !== 0 ? `${diff > 0 ? "+" : ""}${diff.toLocaleString()}` : null;
    const percentChange = ((diff / currentNum) * 100).toFixed(1);

    if (diff > 0) {
        return `+${diff.toLocaleString()} (+${percentChange}%)`;
    } else if (diff < 0) {
        return `${diff.toLocaleString()} (${percentChange}%)`;
    }
    return "No change";
};

function DetailValueRow({ label, type, value }: { label: string; type?: string; value: ReactNode }) {
    return (
        <div className="rounded bg-card-elevated border border-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-tertiary">{label}</span>
                {type && (
                    <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                        {type}
                    </span>
                )}
            </div>
            <div className="mt-1 break-words text-left font-mono text-[11px] leading-relaxed text-text-secondary">
                {value}
            </div>
        </div>
    );
}

function ParamValue({ action, param }: { action: ProposalAction; param: DisplayParam }) {
    const amount = isTokenAmountParam(action, param.name) ? formattedTokenAmount(param.value, action) : null;

    if (amount) {
        return (
            <span>
                <span className="font-semibold text-text-primary">{amount.display}</span>
                {amount.hasUnitConversion && (
                    <span className="mt-0.5 block text-[10px] text-text-muted">raw {amount.rawDisplay}</span>
                )}
            </span>
        );
    }

    return <span>{param.value}</span>;
}

function MoveTypeValue({ label, type }: { label: string; type: string }) {
    return (
        <span>
            <span className="block font-sans text-sm font-semibold text-text-primary">{label}</span>
            <span className="mt-0.5 block break-all text-[10px] text-text-muted">{type}</span>
        </span>
    );
}

function CoinValue({ action }: { action: ProposalAction }) {
    const coin = getCoinDisplay(action);
    if (!coin.coinType) return null;

    return (
        <span>
            <span className="block font-sans text-sm font-semibold text-text-primary">{coin.symbol || "Coin"}</span>
            <span className="mt-0.5 block break-all text-[10px] text-text-muted">{coin.coinType}</span>
        </span>
    );
}

function RawActionData({ value }: { value: string }) {
    return (
        <div className="space-y-1">
            <span className="text-xs text-text-tertiary">Raw Action Data</span>
            <div className="max-h-24 overflow-y-auto break-all rounded bg-card-elevated border border-border px-2 py-1.5 font-mono text-[11px] text-text-secondary">
                {value}
            </div>
        </div>
    );
}

function renderOnChainActionDetails(action: ProposalAction) {
    const { decoded, params } = getActionParams(action);
    const coin = getCoinDisplay(action);
    const actionType = action.data.fullType || action.data.actionType;

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <span className="text-xs text-text-tertiary">Action</span>
                {actionType && (
                    <DetailValueRow
                        label="Type"
                        value={<MoveTypeValue label={getActionDisplayName(action)} type={actionType} />}
                    />
                )}
                {coin.coinType && <DetailValueRow label="Coin" value={<CoinValue action={action} />} />}
                {action.data.actionVersion != null && (
                    <DetailValueRow label="Version" value={String(action.data.actionVersion)} />
                )}
            </div>

            <div className="space-y-1.5">
                <span className="text-xs text-text-tertiary">Call Params</span>
                {decoded?.error && (
                    <div className="rounded bg-error/10 border border-error/30 px-2 py-1.5 text-xs text-error-light">
                        Could not decode params: {decoded.error}
                    </div>
                )}
                {params.length > 0 ? (
                    params.map((param, index) => (
                        <DetailValueRow
                            key={`${param.name}-${index}`}
                            label={formatParamLabel(param.name)}
                            type={param.type}
                            value={<ParamValue action={action} param={param} />}
                        />
                    ))
                ) : (
                    <div className="rounded bg-card-elevated border border-border px-2 py-1.5 text-xs text-text-muted">
                        No decoded params available for this action type.
                    </div>
                )}
            </div>

            {(!decoded || decoded.error) && action.data.actionData && <RawActionData value={action.data.actionData} />}
        </div>
    );
}

export const renderActionDetails = (action: ProposalAction) => {
    switch (action.type) {
        case "memo":
            return <div className="text-sm text-text-secondary leading-relaxed">{action.data.message}</div>;
        case "config":
            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Category</span>
                        <span className="text-xs text-text-secondary font-medium">
                            {action.data.configUpdates?.[0]?.category}
                        </span>
                    </div>
                    {action.data.configUpdates && action.data.configUpdates.length > 0 ? (
                        action.data.configUpdates.map((update, index) => {
                            const diff = update.currentValue ? calculateDiff(update.currentValue, update.value) : null;
                            const isIncrease = diff && diff.startsWith("+");
                            const isDecrease = diff && diff.startsWith("-") && diff !== "No change";

                            return (
                                <div
                                    key={index}
                                    className="p-2 bg-card-elevated rounded-lg border border-border space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-text-tertiary">Parameter</span>
                                        <span className="text-sm text-text-primary font-medium">
                                            {update.parameter}
                                        </span>
                                    </div>
                                    {update.currentValue && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-text-tertiary">Current Value</span>
                                            <span className="text-xs text-text-secondary font-mono">
                                                {formatNumberWithCommas(Number(update.currentValue))} {update.unit}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-text-tertiary">New Value</span>
                                        <span className="text-sm text-text-primary font-semibold font-mono">
                                            {formatNumberWithCommas(Number(update.value))} {update.unit}
                                        </span>
                                    </div>
                                    {diff && diff !== "No change" && (
                                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                            <span className="text-xs text-text-tertiary">Change</span>
                                            <span
                                                className={`text-xs font-semibold ${
                                                    isIncrease
                                                        ? "text-green-400"
                                                        : isDecrease
                                                          ? "text-red-400"
                                                          : "text-text-muted"
                                                }`}
                                            >
                                                {diff}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-sm text-text-muted">No config updates</div>
                    )}
                </div>
            );
        case "transfer":
            return (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Recipient</span>
                        <ExplorerLink id={action.data.recipientAddress || ""} type="address" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Amount</span>
                        <span className="text-sm text-text-primary font-semibold">
                            {formatNumberWithCommas(Number(action.data.amount))} {action.data.token}
                        </span>
                    </div>
                </div>
            );
        case "createStream":
            return (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Recipient</span>
                        <ExplorerLink id={action.data.recipientAddress || ""} type="address" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Amount</span>
                        <span className="text-sm text-text-primary font-semibold">
                            {formatNumberWithCommas(Number(action.data.amount))} {action.data.token}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Duration</span>
                        <span className="text-xs text-text-secondary">
                            {action.data.startDate} → {action.data.endDate}
                        </span>
                    </div>
                    {action.data.description && (
                        <div className="pt-1">
                            <p className="text-xs text-text-tertiary">{action.data.description}</p>
                        </div>
                    )}
                </div>
            );
        case "onChain":
            return renderOnChainActionDetails(action);
    }
};
