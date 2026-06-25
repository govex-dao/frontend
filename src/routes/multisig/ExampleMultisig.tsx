import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Coins,
    Hourglass,
    Shield,
    WalletCards,
} from "lucide-react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CoinAvatar } from "@/components/CoinAvatar";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import { IntentCard } from "@/components/multisig/IntentCard";
import { MemberRow } from "@/components/multisig/MemberRow";
import { StreamCard } from "@/components/multisig/StreamCard";
import { VestingCard } from "@/components/VestingCard";
import { formatNumberWithCommas } from "@/lib/formatNumber";
import {
    MULTISIG_INTENT_STATUS,
    PERMISSION_CANCEL,
    PERMISSION_EXECUTE,
    PERMISSION_PROPOSE,
    PERMISSION_VOTE,
} from "@/lib/sui/multisig";
import type { IntentSummary, MultisigConfig, VaultCoinBalance, VaultStreamInfo } from "@/lib/sui/multisig";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const EXAMPLE_ACCOUNT_ID = "0x4eedc223e50297adf3fd0124af3a114384b43685870a70140b44e2c51ac3505e";
const ALICE = "0x72722cd52399b1e7c789a7aaa9ed2f198dbe012404ff0223f75a1a8d623d54f5";
const BOB = "0xcad054bfa05142e1522d23de533182ce1af4e00c3d4753e205a36c3fec42a83a";
const CAROL = "0x16094e8525602afbda3b4c493c7b5be3a09add0397239cc42bc8569d21152a50";
const EXAMPLE_VIEWER = BOB;
const CONTRIBUTOR = "0xfed96874a96193823826001a96856167c3963266791214d92416ad3cb97be499";
const VENDOR = "0x6375f93dc12b72466e4d22707a3e3fe3257f95d0817da2516a988ac002169eec";
const ACTIONS_PACKAGE = "0x7cc89124f3f190fe390d3cd855348e34ffa28d51ccec6030176cc75a2452961e";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const ALL_PERMISSIONS = PERMISSION_PROPOSE | PERMISSION_VOTE | PERMISSION_EXECUTE | PERMISSION_CANCEL;

const EXAMPLE_CONFIG: MultisigConfig = {
    name: "Example Multisig",
    globalThreshold: 2,
    executionTimelockMs: 0,
    intentExpiryMs: 14 * DAY_MS,
    configNonce: 3,
    members: [
        { address: ALICE, weight: 1, permissions: ALL_PERMISSIONS },
        { address: BOB, weight: 1, permissions: ALL_PERMISSIONS },
        { address: CAROL, weight: 1, permissions: ALL_PERMISSIONS },
    ],
    groups: [
        {
            name: "Members",
            members: [
                { address: ALICE, weight: 1 },
                { address: BOB, weight: 1 },
                { address: CAROL, weight: 1 },
            ],
            timeBands: [],
        },
    ],
    approvePolicy: { paths: [{ requirements: [{ groupIndex: 0, threshold: 2 }] }] },
    cancelPolicy: { paths: [{ requirements: [{ groupIndex: 0, threshold: 2 }] }] },
    proposeGroups: [0],
    executeGroups: [0],
    cancelGroups: [0],
    isExecutionPermissionless: false,
};

const VAULT_BALANCES: VaultCoinBalance[] = [
    { vaultName: "Treasury", coinType: USDC, amount: 168_000_000_000n },
    { vaultName: "Payroll", coinType: USDC, amount: 52_000_000_000n },
];

const STREAMS: VaultStreamInfo[] = [
    {
        id: "0x78b008d8dc4a5bd64ca5b17feb3eee42451dcfaafcfbf48f4009094c7b7d6d69",
        vaultName: "Payroll",
        coinType: USDC,
        capId: "0x78b008d8dc4a5bd64ca5b17feb3eee42451dcfaafcfbf48f4009094c7b7d6d69",
        streamId: "0x1f5ca298c2eb74fc0c93274980385073bf0cbea9a5e7b3d5a1837a7c3583eee0",
        accountId: EXAMPLE_ACCOUNT_ID,
        accountAddr: EXAMPLE_ACCOUNT_ID,
        capHolder: CONTRIBUTOR,
        amountPerIteration: 4_000_000_000n,
        claimedAmount: 8_000_000_000n,
        firstUnclaimedIteration: 2n,
        partialClaimedInIteration: 0n,
        startTimeMs: Date.now() - 75 * DAY_MS,
        iterationsTotal: 12,
        iterationPeriodMs: 30 * DAY_MS,
        claimWindowMs: null,
        expiryMs: null,
        whitelistedRecipients: [],
        isSpendingLimit: false,
    },
    {
        id: "0x31c251f5a962078b7e4b2011f05cda35c11cd00e1f24a96d36cf212e2dfba447",
        vaultName: "Treasury",
        coinType: USDC,
        capId: "0x31c251f5a962078b7e4b2011f05cda35c11cd00e1f24a96d36cf212e2dfba447",
        accountId: EXAMPLE_ACCOUNT_ID,
        accountAddr: EXAMPLE_ACCOUNT_ID,
        capHolder: CAROL,
        amountPerIteration: 25_000_000_000n,
        claimedAmount: 8_500_000_000n,
        firstUnclaimedIteration: 1n,
        partialClaimedInIteration: 0n,
        startTimeMs: Date.now() - 40 * DAY_MS,
        iterationsTotal: 6,
        iterationPeriodMs: 30 * DAY_MS,
        claimWindowMs: null,
        expiryMs: Date.now() + 120 * DAY_MS,
        whitelistedRecipients: [CONTRIBUTOR, VENDOR],
        isSpendingLimit: true,
    },
];

const VESTING = {
    vestingId: "0x7967e072d3257d07fbe2f1f36e8dd0cb06dce7206501ba27eb65fd4ca0c19189",
    accountId: EXAMPLE_ACCOUNT_ID,
    coinType: USDC,
    balance: 48_000_000_000n,
    amountPerIteration: 6_000_000_000n,
    claimedAmount: 12_000_000_000n,
    startTimeMs: Date.now() - 90 * DAY_MS,
    iterationsTotal: 8,
    iterationPeriodMs: 30 * DAY_MS,
    isCancellable: true,
};

function actionType(moduleType: string): string {
    const [module, name] = moduleType.split("::");
    return `${ACTIONS_PACKAGE}::${module}::${name}<${USDC}>`;
}

function approvals({
    status,
    approved,
    rejected = [],
    approvedAtMs = 0,
    matchedVotePath = null,
}: {
    status: number;
    approved: string[];
    rejected?: string[];
    approvedAtMs?: number;
    matchedVotePath?: number | null;
}) {
    return {
        configNonce: EXAMPLE_CONFIG.configNonce,
        status,
        totalWeight: approved.length,
        cancelWeight: rejected.length,
        approvedAtMs,
        matchedVotePath,
        approved,
        rejected,
    };
}

function makeIntent({
    key,
    description,
    createdAtMs,
    expirationMs,
    actionTypes,
    status,
    approved,
    rejected,
    isConfigIntent = false,
    approvedAtMs = 0,
    matchedVotePath = null,
}: {
    key: string;
    description: string;
    createdAtMs: number;
    expirationMs: number;
    actionTypes: string[];
    status: number;
    approved: string[];
    rejected?: string[];
    isConfigIntent?: boolean;
    approvedAtMs?: number;
    matchedVotePath?: number | null;
}): IntentSummary {
    return {
        key,
        description,
        account: EXAMPLE_ACCOUNT_ID,
        createdAtMs,
        expirationMs,
        isConfigIntent,
        actionCount: actionTypes.length,
        actionTypes,
        approvals: approvals({ status, approved, rejected, approvedAtMs, matchedVotePath }),
    };
}

function useExampleIntents(): IntentSummary[] {
    return useMemo(() => {
        const now = Date.now();
        return [
            makeIntent({
                key: "spend-contributor-payroll",
                description: "Spend 15,000 USDC from Payroll for contributor invoices.",
                createdAtMs: now - 2 * DAY_MS,
                expirationMs: now + 12 * DAY_MS,
                actionTypes: [actionType("vault::VaultSpend")],
                status: MULTISIG_INTENT_STATUS.ACTIVE,
                approved: [ALICE],
            }),
            makeIntent({
                key: "create-monthly-stream",
                description: "Create a monthly USDC spending limit from Payroll to a contributor.",
                createdAtMs: now - 4 * DAY_MS,
                expirationMs: now + 10 * DAY_MS,
                actionTypes: [actionType("vault::CreateStream")],
                status: MULTISIG_INTENT_STATUS.APPROVED,
                approved: [ALICE, BOB],
                approvedAtMs: now - 5 * HOUR_MS,
                matchedVotePath: 0,
            }),
            makeIntent({
                key: "create-vesting-coins",
                description: "Create 48,000 USDC vesting coins for a long-term contributor.",
                createdAtMs: now - 20 * DAY_MS,
                expirationMs: now - 6 * DAY_MS,
                actionTypes: [actionType("vesting::CreateVesting")],
                status: MULTISIG_INTENT_STATUS.EXECUTED,
                approved: [ALICE, CAROL],
                approvedAtMs: now - 18 * DAY_MS,
                matchedVotePath: 0,
            }),
        ];
    }, []);
}

interface CollapsibleSectionProps {
    title: string;
    count?: number;
    icon?: ReactNode;
    defaultOpen?: boolean;
    children: ReactNode;
}

function CollapsibleSection({ title, count, icon, defaultOpen = true, children }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        setIsOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <section className="space-y-3">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 border-b border-border-subtle pb-2 text-left transition-colors hover:border-border-light"
            >
                <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                    {icon}
                    {title}
                    {count != null && count > 0 ? (
                        <span className="text-xs font-medium text-text-muted">({count})</span>
                    ) : null}
                </span>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                )}
            </button>
            {isOpen && <div>{children}</div>}
        </section>
    );
}

function formatCoinAmount(amount: bigint, decimals: number): string {
    return formatNumberWithCommas(Number(amount) / 10 ** decimals);
}

function VaultHoldings({ balances }: { balances: VaultCoinBalance[] }) {
    const row = balances.reduce(
        (acc, balance) => {
            acc.amount += balance.amount;
            acc.vaults.push(balance.vaultName);
            return acc;
        },
        { amount: 0n, vaults: [] as string[] }
    );

    return (
        <div className="overflow-x-auto rounded-xl border border-white/[0.085] bg-white/[0.035] backdrop-blur-md">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-white/[0.075] bg-white/[0.04]">
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Asset
                        </th>
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Vaults
                        </th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Balance
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-white/[0.065] last:border-b-0 transition-colors hover:bg-white/[0.035]">
                        <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                                <CoinAvatar coinType={USDC} symbol="USDC" iconUrl={null} size="lg" />
                                <div>
                                    <p className="text-sm font-medium text-text-primary">USD Coin</p>
                                    <p className="text-xs text-text-muted">USDC</p>
                                </div>
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="flex gap-1.5 flex-wrap">
                                {row.vaults.map((vaultName) => (
                                    <span
                                        key={vaultName}
                                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                                    >
                                        {vaultName}
                                    </span>
                                ))}
                            </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                            <span className="font-mono font-medium text-text-primary">
                                {formatCoinAmount(row.amount, 6)}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export function ExampleMultisig() {
    const intents = useExampleIntents();
    const pendingIntents = intents.filter((intent) =>
        (intent.approvals.status === MULTISIG_INTENT_STATUS.ACTIVE ||
            intent.approvals.status === MULTISIG_INTENT_STATUS.APPROVED)
    );
    const closedIntents = intents.filter((intent) =>
        intent.approvals.status === MULTISIG_INTENT_STATUS.REJECTED ||
        intent.approvals.status === MULTISIG_INTENT_STATUS.EXECUTED
    );
    const scheduledPayments = STREAMS;

    return (
        <div className="route-container min-h-full flex flex-col gap-6 pb-16">
            <Helmet>
                <title>Example Multisig</title>
            </Helmet>
            <Breadcrumbs
                items={[
                    { label: "Home", href: "/" },
                    { label: "Multisigs", href: "/multisig" },
                    { label: "Example" },
                ]}
            />

            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3">
                        <Shield className="w-7 h-7 text-primary" />
                        {EXAMPLE_CONFIG.name}
                    </h1>
                    <div className="mt-1 flex max-w-full items-start gap-1.5">
                        <CopyableAddress
                            address={EXAMPLE_ACCOUNT_ID}
                            className="min-w-0"
                            textClassName="font-mono text-sm text-text-muted"
                            copyLabel="Copy example multisig address"
                            toastMessage="Example multisig address copied"
                        />
                    </div>
                </div>
                <Link
                    to="/multisig"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.085] bg-white/[0.045] px-3 py-2 text-xs font-medium text-text-secondary backdrop-blur-md transition-colors hover:bg-white/[0.075] hover:text-text-primary"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                </Link>
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Coins className="w-5 h-5 text-primary" />
                        Vault Holdings (1)
                    </h2>
                </div>
                <VaultHoldings balances={VAULT_BALANCES} />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <Hourglass className="w-5 h-5 text-primary" />
                        Pending Intents ({pendingIntents.length})
                    </h2>
                </div>
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    {pendingIntents.map((intent) => (
                        <IntentCard
                            key={intent.key}
                            intent={intent}
                            config={EXAMPLE_CONFIG}
                            accountId={EXAMPLE_ACCOUNT_ID}
                            configNonce={EXAMPLE_CONFIG.configNonce}
                            currentUserAddress={EXAMPLE_VIEWER}
                            previewMode
                        />
                    ))}
                </div>
            </div>

            <CollapsibleSection
                title="Spending Limits"
                count={scheduledPayments.length}
                icon={<WalletCards className="h-4 w-4 text-primary" />}
            >
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    {scheduledPayments.map((stream) => (
                        <StreamCard key={stream.id} stream={stream} />
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                title="Vesting Coins"
                count={1}
                icon={<Coins className="h-4 w-4 text-primary" />}
                defaultOpen={false}
            >
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    <VestingCard vesting={VESTING} />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                title="Members"
                count={EXAMPLE_CONFIG.members.length}
                icon={<Shield className="h-4 w-4 text-primary" />}
                defaultOpen={false}
            >
                <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr className="border-b border-border bg-card-elevated">
                                <th className="w-[58%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                    Address
                                </th>
                                <th className="w-24 text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                    Weight
                                </th>
                                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                    Permissions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {EXAMPLE_CONFIG.members.map((member) => (
                                <MemberRow key={member.address} member={member} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                title="Closed Intents"
                count={closedIntents.length}
                icon={<Shield className="h-4 w-4 text-primary" />}
                defaultOpen={false}
            >
                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                    {closedIntents.map((intent) => (
                        <IntentCard
                            key={intent.key}
                            intent={intent}
                            config={EXAMPLE_CONFIG}
                            accountId={EXAMPLE_ACCOUNT_ID}
                            configNonce={EXAMPLE_CONFIG.configNonce}
                            currentUserAddress={EXAMPLE_VIEWER}
                            previewMode
                        />
                    ))}
                </div>
            </CollapsibleSection>

            <p className="text-xs text-text-muted">
                Example data only. Connect a wallet to create and manage live multisig accounts.
            </p>
        </div>
    );
}
