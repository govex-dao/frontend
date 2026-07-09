import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_TYPE_ARG } from "@mysten/sui/utils";
import toast from "react-hot-toast";
// Force rebuild with latest SDK deployment config
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Select, type SelectOption } from "@/components/inputs/Select";
import { TokenInput } from "@/components/inputs/TokenInput";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { useMultisigVaultNames, useVaultApprovedCoinTypes } from "@/hooks/useMultisig";
import { getSDKForProtocolVersion, isSupportedProtocolVersion } from "@/lib/sdk";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import { formatUnitsForInput } from "@/lib/units";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    accountId: string;
    /** Override the Account config type. Defaults to MultisigConfig. Pass "futarchy" for DAO accounts. */
    accountType?: "multisig" | "futarchy";
    /** Protocol version for the target account. Required for legacy DAO accounts on mainnet. */
    protocolVersion?: string | null;
    onSuccess?: () => void;
}

interface DepositModalContentProps {
    vaultNamesLoaded: boolean;
    hasVaults: boolean;
    hasSelectedVault: boolean;
    approvedCoinTypesLoaded: boolean;
    approvedCoinTypes?: string[];
    vaultOptions: SelectOption[];
    vaultName: string;
    setVaultName: (value: string) => void;
    coinType: string;
    setCoinType: (value: string) => void;
    setCoinDecimals: (value: number) => void;
    setCoinBalanceDisplay: (value: string) => void;
    amount: string;
    setAmount: (value: string) => void;
    coinBalanceDisplay: string;
    hasAccount: boolean;
    isValid: boolean;
    isSupportedProtocol: boolean;
    isSubmitting: boolean;
    isLoading: boolean;
    onDeposit: () => void;
}

function getDepositButtonLabel(
    hasAccount: boolean,
    isSupportedProtocol: boolean,
    hasVaults: boolean,
    hasSelectedVault: boolean
): string {
    if (!hasAccount) return "Connect Wallet";
    if (!isSupportedProtocol) return "Unavailable";
    if (!hasVaults) return "Create a vault first";
    return hasSelectedVault ? "Deposit" : "Select a vault";
}

export function DepositModal({
    isOpen,
    onClose,
    accountId,
    accountType = "multisig",
    protocolVersion,
    onSuccess,
}: Props) {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);

    const { data: vaultNames } = useMultisigVaultNames(accountId);

    const [vaultName, setVaultName] = useState("");
    const [coinType, setCoinType] = useState("");
    const [coinDecimals, setCoinDecimals] = useState(9);
    const [coinBalanceDisplay, setCoinBalanceDisplay] = useState("");
    const [amount, setAmount] = useState("");

    const vaultNamesLoaded = vaultNames !== undefined;
    const hasVaults = (vaultNames?.length ?? 0) > 0;
    const resolvedVaultName = hasVaults ? vaultName : "";
    const hasSelectedVault = resolvedVaultName.length > 0;

    const { data: approvedCoinTypes } = useVaultApprovedCoinTypes(accountId, resolvedVaultName || undefined);
    const approvedCoinTypesLoaded = !hasSelectedVault || approvedCoinTypes !== undefined;
    const selectedCoinIsApproved = approvedCoinTypes?.includes(coinType) ?? false;
    const isSupportedProtocol = isSupportedProtocolVersion(protocolVersion);

    useEffect(() => {
        if (!isOpen) return;
        setVaultName("");
        setCoinType("");
        setCoinDecimals(9);
        setCoinBalanceDisplay("");
        setAmount("");
    }, [isOpen]);

    // Reset coin selection when vault changes
    useEffect(() => {
        setCoinType("");
        setCoinDecimals(9);
        setCoinBalanceDisplay("");
        setAmount("");
    }, [resolvedVaultName]);

    const isValid =
        !!account &&
        isSupportedProtocol &&
        hasVaults &&
        resolvedVaultName.length > 0 &&
        approvedCoinTypesLoaded &&
        selectedCoinIsApproved &&
        coinType.length > 0 &&
        amount.length > 0 &&
        parseFloat(amount) > 0;

    const handleDeposit = useCallback(async () => {
        if (submittingRef.current || !account || !isValid) return;
        submittingRef.current = true;

        try {
            const sdk = getSDKForProtocolVersion(protocolVersion);
            const actionsPackage = sdk.packages.accountActions;
            const multisigPackage = sdk.packages.accountMultisig;
            const futarchyCorePackage = sdk.packages.futarchyCore;
            const registryId = sdk.sharedObjects.packageRegistry.id;

            if (!actionsPackage) throw new Error("accountActions package not configured");

            const configType =
                accountType === "futarchy"
                    ? `${futarchyCorePackage}::futarchy_config::FutarchyConfig`
                    : `${multisigPackage}::multisig::MultisigConfig`;
            const amountBaseUnits = parseAmountToBigInt(amount, coinDecimals);

            const tx = new Transaction();
            let depositCoin: ReturnType<typeof tx.splitCoins>[0];

            if (coinType === SUI_TYPE_ARG) {
                [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountBaseUnits)]);
            } else {
                const allCoins: { coinObjectId: string }[] = [];
                let cursor: string | null | undefined = undefined;
                let hasNext = true;

                while (hasNext) {
                    const page = await suiClient.getCoins({
                        owner: account.address,
                        coinType,
                        cursor: cursor ?? undefined,
                    });
                    allCoins.push(...page.data);
                    hasNext = page.hasNextPage;
                    cursor = page.nextCursor;
                }

                if (allCoins.length === 0) {
                    throw new Error("No coins of this type found in your wallet");
                }

                const primaryCoin = tx.object(allCoins[0].coinObjectId);

                if (allCoins.length > 1) {
                    tx.mergeCoins(
                        primaryCoin,
                        allCoins.slice(1).map((c) => tx.object(c.coinObjectId))
                    );
                }

                [depositCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountBaseUnits)]);
            }

            tx.moveCall({
                target: `${actionsPackage}::vault::deposit_approved`,
                typeArguments: [configType, coinType],
                arguments: [
                    tx.object(accountId),
                    tx.object(registryId),
                    tx.pure.string(resolvedVaultName),
                    depositCoin,
                ],
            });

            await executeTransaction(
                tx,
                {
                    onSuccess: () => {
                        onSuccess?.();
                        onClose();
                    },
                },
                {
                    loadingMessage: "Depositing to vault...",
                    successMessage: "Deposit successful!",
                }
            );
        } catch (error) {
            console.error("Failed to deposit:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Failed to deposit");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        account,
        accountId,
        accountType,
        amount,
        coinDecimals,
        coinType,
        executeTransaction,
        isValid,
        onClose,
        onSuccess,
        protocolVersion,
        resolvedVaultName,
        suiClient,
    ]);

    const vaultOptions = (vaultNames ?? []).map((name) => ({
        value: name,
        label: name,
    }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Deposit to Vault" className="w-full max-w-lg!">
            <DepositModalContent
                vaultNamesLoaded={vaultNamesLoaded}
                hasVaults={hasVaults}
                hasSelectedVault={hasSelectedVault}
                approvedCoinTypesLoaded={approvedCoinTypesLoaded}
                approvedCoinTypes={approvedCoinTypes}
                vaultOptions={vaultOptions}
                vaultName={vaultName}
                setVaultName={setVaultName}
                coinType={coinType}
                setCoinType={setCoinType}
                setCoinDecimals={setCoinDecimals}
                setCoinBalanceDisplay={setCoinBalanceDisplay}
                amount={amount}
                setAmount={setAmount}
                coinBalanceDisplay={coinBalanceDisplay}
                hasAccount={!!account}
                isValid={isValid}
                isSupportedProtocol={isSupportedProtocol}
                isSubmitting={submittingRef.current}
                isLoading={isLoading}
                onDeposit={handleDeposit}
            />
        </Modal>
    );
}

function DepositModalContent(props: DepositModalContentProps) {
    const {
        vaultNamesLoaded,
        hasVaults,
        hasSelectedVault,
        approvedCoinTypesLoaded,
        approvedCoinTypes,
        vaultOptions,
        vaultName,
        setVaultName,
        coinType,
        setCoinType,
        setCoinDecimals,
        setCoinBalanceDisplay,
        amount,
        setAmount,
        coinBalanceDisplay,
        hasAccount,
        isValid,
        isSupportedProtocol,
        isSubmitting,
        isLoading,
        onDeposit,
    } = props;

    return (
        <div className="space-y-5">
            {!vaultNamesLoaded ? (
                <p className="text-sm text-text-muted">Loading vaults...</p>
            ) : hasVaults ? (
                <Select
                    label="Vault"
                    options={vaultOptions}
                    value={vaultName}
                    onChange={setVaultName}
                    allowClear={false}
                />
            ) : (
                <div className="rounded-lg border border-border bg-card-elevated/60 px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">
                        Create your first vault to hold coins with through an intent.
                    </p>
                </div>
            )}

            {hasVaults && !hasSelectedVault && <p className="text-sm text-text-muted">Select a vault to continue.</p>}

            {hasSelectedVault && !approvedCoinTypesLoaded && (
                <p className="text-sm text-text-muted">Loading approved coin types...</p>
            )}

            {hasSelectedVault && approvedCoinTypesLoaded && (approvedCoinTypes?.length ?? 0) === 0 && (
                <div className="rounded-lg border border-border bg-card-elevated/60 px-4 py-3">
                    <p className="text-sm font-medium text-text-primary">This vault has no approved coin types yet.</p>
                </div>
            )}

            {hasSelectedVault && approvedCoinTypesLoaded && (approvedCoinTypes?.length ?? 0) > 0 && (
                <>
                    <CoinTypePicker
                        value={coinType}
                        onChange={(type, decimals, balanceRaw) => {
                            setCoinType(type);
                            setCoinDecimals(decimals);
                            setCoinBalanceDisplay(balanceRaw ? formatUnitsForInput(BigInt(balanceRaw), decimals) : "0");
                        }}
                        label="Coin Type"
                        allowedCoinTypes={approvedCoinTypes ?? []}
                    />

                    <TokenInput
                        label="Amount"
                        value={amount}
                        onChange={setAmount}
                        placeholder="0.00"
                        balance={coinBalanceDisplay}
                        maxBalanceValue={coinBalanceDisplay}
                    />
                </>
            )}

            <Button
                className="w-full h-11 font-medium"
                disabled={!isValid || isSubmitting}
                isLoading={isLoading}
                onClick={onDeposit}
            >
                {getDepositButtonLabel(hasAccount, isSupportedProtocol, hasVaults, hasSelectedVault)}
            </Button>
        </div>
    );
}
