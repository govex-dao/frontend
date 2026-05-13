import { useState, useCallback, useEffect, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_TYPE_ARG } from "@mysten/sui/utils";
import toast from "react-hot-toast";
// Force rebuild with latest SDK deployment config
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Select } from "@/components/inputs/Select";
import { Input } from "@/components/inputs/Input";
import { TokenInput } from "@/components/inputs/TokenInput";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { useMultisigVaultNames, useVaultApprovedCoinTypes } from "@/hooks/useMultisig";
import { getSDKForProtocolVersion } from "@/lib/sdk";
import { parseAmountToBigInt } from "@/lib/parseAmount";

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
  const [manualVaultName, setManualVaultName] = useState("");
  const [coinType, setCoinType] = useState("");
  const [coinDecimals, setCoinDecimals] = useState(9);
  const [coinBalanceDisplay, setCoinBalanceDisplay] = useState("");
  const [amount, setAmount] = useState("");

  const resolvedVaultName = vaultNames && vaultNames.length > 0 ? vaultName : manualVaultName;

  const { data: approvedCoinTypes } = useVaultApprovedCoinTypes(accountId, resolvedVaultName || undefined);

  useEffect(() => {
    if (!isOpen) return;
    setVaultName("");
    setManualVaultName("");
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
    resolvedVaultName.length > 0 &&
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

      const configType = accountType === "futarchy"
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
          const page = await suiClient.getCoins({ owner: account.address, coinType, cursor: cursor ?? undefined });
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
            allCoins.slice(1).map((c) => tx.object(c.coinObjectId)),
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
        },
      );
    } catch (error) {
      console.error("Failed to deposit:", error);
      if (!isNotifiedTransactionError(error)) {
        toast.error(error instanceof Error ? error.message : "Failed to deposit");
      }
    } finally {
      submittingRef.current = false;
    }
  }, [account, accountId, accountType, amount, coinDecimals, coinType, executeTransaction, isValid, onClose, onSuccess, protocolVersion, resolvedVaultName, suiClient]);

  const vaultOptions = (vaultNames ?? []).map((name) => ({
    value: name,
    label: name,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit to Vault" className="w-full max-w-lg!">
      <div className="space-y-5">
        {vaultNames && vaultNames.length > 0 ? (
          <Select
            label="Vault"
            options={vaultOptions}
            value={vaultName}
            onChange={setVaultName}
            allowClear={false}
          />
        ) : (
          <Input
            label="Vault Name"
            value={manualVaultName}
            onChange={setManualVaultName}
            placeholder="e.g. treasury"
          />
        )}

        <CoinTypePicker
          value={coinType}
          onChange={(type, decimals, balanceRaw) => {
            setCoinType(type);
            setCoinDecimals(decimals);
            if (balanceRaw) {
              const bi = BigInt(balanceRaw);
              const divisor = BigInt(10 ** decimals);
              const whole = bi / divisor;
              const remainder = bi % divisor;
              const frac = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
              setCoinBalanceDisplay(frac ? `${whole}.${frac}` : whole.toString());
            } else {
              setCoinBalanceDisplay("0");
            }
          }}
          label="Coin Type"
          allowedCoinTypes={approvedCoinTypes}
        />

        <TokenInput
          label="Amount"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
          balance={coinBalanceDisplay}
          maxBalanceValue={coinBalanceDisplay}
        />

        <Button
          className="w-full h-11 font-medium"
          disabled={!isValid || submittingRef.current}
          isLoading={isLoading}
          onClick={handleDeposit}
        >
          {!account ? "Connect Wallet" : "Deposit"}
        </Button>
      </div>
    </Modal>
  );
}
