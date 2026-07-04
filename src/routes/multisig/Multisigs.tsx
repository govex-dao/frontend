import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Shield, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { AccountCard } from "@/components/multisig/AccountCard";
import { CreateMultisigModal } from "@/components/multisig/CreateMultisigModal";
import { useMyMultisigs } from "@/hooks/api";
import { useSavedMultisigIds } from "@/hooks/useMultisigIds";
import { useMyLinkedMultisigAccounts } from "@/hooks/useMyVestingsAndStreams";
import { useMultisigConfig } from "@/hooks/useMultisig";
import type { MultisigListItem } from "@/lib/api";
import { normalizeSuiAddress } from "@/lib/sui/multisig";

const ITEMS_PER_PAGE = 6;
const EXAMPLE_MULTISIG = {
    accountId: "0x4eedc223e50297adf3fd0124af3a114384b43685870a70140b44e2c51ac3505e",
    accountName: "Example Multisig",
    memberCount: 3,
};

type MultisigItem =
    | { type: "backend"; ms: MultisigListItem }
    | { type: "saved"; id: string }
    | { type: "linked"; id: string };

function accountKey(id: string | undefined): string {
    return normalizeSuiAddress(id) || "";
}

function ResolvedAccountCard({
    accountId,
    accountName: fallbackName,
    memberCount,
    onRemove,
}: {
    accountId: string;
    accountName: string;
    memberCount: number;
    onRemove?: () => void;
}) {
    const { data: config } = useMultisigConfig(accountId);
    const accountName = config?.name?.trim() || fallbackName;

    return (
        <AccountCard accountId={accountId} accountName={accountName} memberCount={memberCount} onRemove={onRemove} />
    );
}

function Pagination({
    page,
    totalPages,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
}) {
    return (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <button
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.085] bg-white/[0.045] backdrop-blur-md transition-all hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-40"
            >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Previous</span>
            </button>
            <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => onPageChange(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === page ? "bg-primary w-8" : "bg-white/20 hover:bg-white/40"}`}
                    />
                ))}
            </div>
            <button
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.085] bg-white/[0.045] backdrop-blur-md transition-all hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-40"
            >
                <span className="text-sm">Next</span>
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

export function Multisigs() {
    const account = useCurrentAccount();
    const { data: multisigs, isLoading } = useMyMultisigs();
    const { ids: savedIds, removeId } = useSavedMultisigIds();
    const { data: linkedAccounts = [], isLoading: linkedAccountsLoading } = useMyLinkedMultisigAccounts();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [msPage, setMsPage] = useState(0);

    const multisigItems = useMemo<MultisigItem[]>(() => {
        const items: MultisigItem[] = [];
        const seen = new Set<string>();

        function addItem(id: string | undefined, item: MultisigItem) {
            const key = accountKey(id);
            if (!key || seen.has(key)) return;
            seen.add(key);
            items.push(item);
        }

        (multisigs ?? []).forEach((ms) => addItem(ms.account_id, { type: "backend", ms }));
        savedIds.forEach((id) => addItem(id, { type: "saved", id }));
        linkedAccounts.forEach((linked) => addItem(linked.accountId, { type: "linked", id: linked.accountId }));

        return items;
    }, [linkedAccounts, multisigs, savedIds]);

    const isMemberListLoading = isLoading;
    const totalPages = Math.max(1, Math.ceil(multisigItems.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(msPage, totalPages - 1);
    const showExampleMultisig =
        !account || (!isMemberListLoading && !linkedAccountsLoading && multisigItems.length === 0);

    useEffect(() => {
        setShowCreateModal(false);
    }, [account?.address]);

    useEffect(() => {
        if (msPage > totalPages - 1) setMsPage(totalPages - 1);
    }, [msPage, totalPages]);

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
    };

    return (
        <div className="route-container h-full flex flex-col gap-4 scrollbar-gutter-stable">
            <Helmet>
                <title>Multisigs</title>
            </Helmet>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Multisigs" }]} />

            {showExampleMultisig && (
                <section aria-label="Example multisig">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        <AccountCard
                            accountId={EXAMPLE_MULTISIG.accountId}
                            accountName={EXAMPLE_MULTISIG.accountName}
                            memberCount={EXAMPLE_MULTISIG.memberCount}
                            showAccountId={false}
                            to="/multisig/example"
                        />
                    </div>
                </section>
            )}

            {!account ? (
                /* Not connected */
                <section className="flex flex-col items-center justify-center py-8 md:py-10">
                    <div className="flex flex-col items-center justify-center">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                            <Shield className="h-10 w-10 text-text-disabled" />
                        </div>
                        <h3 className="mb-2">Connect Wallet</h3>
                        <p className="max-w-md text-center text-text-muted">
                            Connect your wallet to create and manage your own multisig accounts.
                        </p>
                    </div>
                </section>
            ) : (
                <section className="glass-flow-panel flex flex-col gap-4 rounded-xl p-4 md:p-6 lg:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Multisigs</h1>
                            <p className="mt-1 max-w-2xl text-sm text-text-muted">
                                Create, manage, or review shared Sui accounts connected to your wallet.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15 hover:text-primary-light transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create
                        </button>
                    </div>

                    {isMemberListLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="glass-flow-panel rounded-xl p-5 flex flex-col gap-3 animate-pulse"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-border" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-32 rounded bg-border" />
                                            <div className="h-3 w-24 rounded bg-border/60" />
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-border-subtle">
                                        <div className="space-y-1">
                                            <div className="h-2.5 w-10 rounded bg-border/60" />
                                            <div className="h-4 w-6 rounded bg-border" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {multisigItems
                                    .slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)
                                    .map((item) =>
                                        item.type === "backend" ? (
                                            <ResolvedAccountCard
                                                key={item.ms.account_id}
                                                accountId={item.ms.account_id}
                                                accountName={item.ms.name}
                                                memberCount={item.ms.member_count}
                                            />
                                        ) : item.type === "saved" ? (
                                            <ResolvedAccountCard
                                                key={item.id}
                                                accountId={item.id}
                                                accountName="Saved Multisig"
                                                memberCount={0}
                                                onRemove={() => removeId(item.id)}
                                            />
                                        ) : (
                                            <ResolvedAccountCard
                                                key={item.id}
                                                accountId={item.id}
                                                accountName="Linked Multisig"
                                                memberCount={0}
                                            />
                                        )
                                    )}

                                {multisigItems.length === 0 && !linkedAccountsLoading && (
                                    <div className="col-span-full flex flex-col items-center justify-center py-16">
                                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center mb-4">
                                            <Shield className="w-8 h-8 text-text-disabled" />
                                        </div>
                                        <h3 className="mb-2 text-lg">No multisigs found</h3>
                                        <p className="text-text-muted text-center max-w-md text-sm">
                                            This wallet is not a member of any indexed multisig accounts and does not
                                            hold linked vesting or spending limit access.
                                        </p>
                                    </div>
                                )}
                            </div>
                            {multisigItems.length > ITEMS_PER_PAGE && (
                                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setMsPage} />
                            )}
                        </>
                    )}
                </section>
            )}

            <CreateMultisigModal isOpen={showCreateModal} onClose={handleCloseCreateModal} />
        </div>
    );
}
