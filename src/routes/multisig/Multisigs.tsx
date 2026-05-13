import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Shield, Plus, ChevronLeft, ChevronRight, Loader2, Timer, Coins, WalletCards } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useSearchParams } from "react-router";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SidebarNav, type SidebarNavItem } from "@/components/navigation/SidebarNav";
import { AccountCard } from "@/components/multisig/AccountCard";
import { VestingCard } from "@/components/VestingCard";
import { StreamCard } from "@/components/multisig/StreamCard";
import { CreateMultisigModal } from "@/components/multisig/CreateMultisigModal";
import { useMyMultisigs } from "@/hooks/api";
import { useSavedMultisigIds } from "@/hooks/useMultisigIds";
import { useMyVestingsAndStreams } from "@/hooks/useMyVestingsAndStreams";

const ITEMS_PER_PAGE = 6;
type TabType = "multisigs" | "streams" | "spending_limits" | "vestings";
const TAB_IDS: readonly TabType[] = ["multisigs", "streams", "spending_limits", "vestings"];

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
      <button
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card-elevated hover:bg-card-more-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card-elevated hover:bg-card-more-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <span className="text-sm">Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Multisigs() {
  const account = useCurrentAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: multisigs, isLoading } = useMyMultisigs();
  const { ids: savedIds, removeId } = useSavedMultisigIds();
  const { vestings, streams, spendingLimits, isLoading: vestingsStreamsLoading } = useMyVestingsAndStreams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [autoCreateDismissed, setAutoCreateDismissed] = useState(false);
  const [streamPage, setStreamPage] = useState(0);
  const [spendingLimitPage, setSpendingLimitPage] = useState(0);
  const [vestingPage, setVestingPage] = useState(0);
  const [msPage, setMsPage] = useState(0);
  const tabParam = searchParams.get("tab");
  const activeTab: TabType = TAB_IDS.includes(tabParam as TabType) ? (tabParam as TabType) : "multisigs";
  const setActiveTab = (tab: TabType) => setSearchParams(tab === "multisigs" ? {} : { tab });
  const navItems: SidebarNavItem[] = [
    { id: "multisigs", label: "Multisigs", icon: <Shield className="w-4 h-4" /> },
    { id: "streams", label: "Payment Streams", icon: <Timer className="w-4 h-4" /> },
    { id: "spending_limits", label: "Preapproved Spending", icon: <WalletCards className="w-4 h-4" /> },
    { id: "vestings", label: "Vestings", icon: <Coins className="w-4 h-4" /> },
  ];

  // Merge backend multisigs with saved IDs (saved IDs that aren't already in backend results)
  const backendAccountIds = new Set(multisigs?.map((m) => m.account_id) || []);
  const extraSavedIds = savedIds.filter((id) => !backendAccountIds.has(id));
  const multisigItems = [
    ...(multisigs?.map((ms) => ({ type: "backend" as const, ms })) ?? []),
    ...extraSavedIds.map((id) => ({ type: "saved" as const, id })),
  ];

  useEffect(() => {
    setAutoCreateDismissed(false);
    setShowCreateModal(false);
  }, [account?.address]);

  useEffect(() => {
    if (!account || isLoading || activeTab !== "multisigs" || multisigItems.length > 0 || autoCreateDismissed) {
      return;
    }
    setShowCreateModal(true);
  }, [account, activeTab, autoCreateDismissed, isLoading, multisigItems.length]);

  const handleCloseCreateModal = () => {
    setAutoCreateDismissed(true);
    setShowCreateModal(false);
  };

  return (
    <div className="route-container h-full flex flex-col gap-3 scrollbar-gutter-stable">
      <Helmet>
        <title>Multisig</title>
      </Helmet>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Multisig" }]} />

      {!account ? (
        /* Not connected */
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 rounded-full bg-card-elevated border border-border-subtle flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-text-disabled" />
          </div>
          <h3 className="mb-2">Connect Wallet</h3>
          <p className="text-text-muted text-center max-w-md">
            Connect your wallet to see your multisigs, vestings, payment streams, and preapproved spending.
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:bg-card rounded-xl -mx-2 md:mx-0 md:border border-border-light md:h-[calc(100vh-7rem)] overflow-hidden">
          <div className="md:hidden border-b border-border-light bg-card">
            <div className="p-4 border-b border-border-light">
              <h1 className="text-2xl font-bold">Multisig</h1>
            </div>
            <div className="flex py-2 px-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                    activeTab === item.id
                      ? "bg-primary text-white"
                      : "text-text-muted hover:bg-card-elevated hover:text-text-light"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:block md:w-64 shrink-0">
            <div className="bg-linear-to-br from-card-elevated to-card-more-elevated border-r border-border-light rounded-l-xl shadow-lg overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-border-light">
                <h1 className="text-2xl font-bold">Multisig</h1>
              </div>
              <SidebarNav
                className="bg-transparent"
                items={navItems}
                activeItem={activeTab}
                onItemClick={(id) => setActiveTab(id as TabType)}
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 gap-3 min-w-0 p-4 md:p-6 lg:p-8 relative h-full overflow-y-auto">
            {activeTab === "multisigs" && (
              <section>
                <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline gap-2 justify-between">
                  <h2 className="text-lg">Multisigs</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15 hover:text-primary-light transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="bg-card-elevated border border-border rounded-xl p-5 flex flex-col gap-3 animate-pulse"
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
                        .slice(msPage * ITEMS_PER_PAGE, (msPage + 1) * ITEMS_PER_PAGE)
                        .map((item) =>
                          item.type === "backend" ? (
                            <AccountCard
                              key={item.ms.account_id}
                              accountId={item.ms.account_id}
                              accountName={item.ms.name}
                              memberCount={item.ms.member_count}
                            />
                          ) : (
                            <AccountCard
                              key={item.id}
                              accountId={item.id}
                              accountName="Saved Multisig"
                              memberCount={0}
                              onRemove={() => removeId(item.id)}
                            />
                          )
                        )}

                      {multisigItems.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                          <div className="w-16 h-16 rounded-full bg-card-elevated border border-border-subtle flex items-center justify-center mb-4">
                            <Shield className="w-8 h-8 text-text-disabled" />
                          </div>
                          <h3 className="mb-2 text-lg">No multisigs found</h3>
                          <p className="text-text-muted text-center max-w-md text-sm">
                            You are not a member of any indexed multisig accounts.
                          </p>
                        </div>
                      )}
                    </div>
                    {multisigItems.length > ITEMS_PER_PAGE && (
                      <Pagination
                        page={msPage}
                        totalPages={Math.ceil(multisigItems.length / ITEMS_PER_PAGE)}
                        onPageChange={setMsPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {activeTab === "streams" && (
              <section>
                <h2 className="text-lg mb-3">Payment Streams{streams.length > 0 ? ` (${streams.length})` : ""}</h2>
                {vestingsStreamsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : streams.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-text-light">No active payment streams.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {streams
                        .slice(streamPage * ITEMS_PER_PAGE, (streamPage + 1) * ITEMS_PER_PAGE)
                        .map((stream) => (
                          <StreamCard key={stream.capId} stream={stream} />
                        ))}
                    </div>
                    {streams.length > ITEMS_PER_PAGE && (
                      <Pagination
                        page={streamPage}
                        totalPages={Math.ceil(streams.length / ITEMS_PER_PAGE)}
                        onPageChange={setStreamPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {activeTab === "spending_limits" && (
              <section>
                <h2 className="text-lg mb-3">
                  Preapproved Spending{spendingLimits.length > 0 ? ` (${spendingLimits.length})` : ""}
                </h2>
                {vestingsStreamsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : spendingLimits.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-text-light">No active preapproved spending.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {spendingLimits
                        .slice(spendingLimitPage * ITEMS_PER_PAGE, (spendingLimitPage + 1) * ITEMS_PER_PAGE)
                        .map((spendingLimit) => (
                          <StreamCard key={spendingLimit.capId} stream={spendingLimit} />
                        ))}
                    </div>
                    {spendingLimits.length > ITEMS_PER_PAGE && (
                      <Pagination
                        page={spendingLimitPage}
                        totalPages={Math.ceil(spendingLimits.length / ITEMS_PER_PAGE)}
                        onPageChange={setSpendingLimitPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {activeTab === "vestings" && (
              <section>
                <h2 className="text-lg mb-3">Vestings{vestings.length > 0 ? ` (${vestings.length})` : ""}</h2>
                {vestingsStreamsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : vestings.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-text-light">No active vestings.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {vestings
                        .slice(vestingPage * ITEMS_PER_PAGE, (vestingPage + 1) * ITEMS_PER_PAGE)
                        .map((vesting) => (
                          <VestingCard key={vesting.capId} vesting={vesting} />
                        ))}
                    </div>
                    {vestings.length > ITEMS_PER_PAGE && (
                      <Pagination
                        page={vestingPage}
                        totalPages={Math.ceil(vestings.length / ITEMS_PER_PAGE)}
                        onPageChange={setVestingPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      <CreateMultisigModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
      />
    </div>
  );
}
