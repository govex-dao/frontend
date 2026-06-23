import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress, formatAddress } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { Textarea } from "@/components/inputs/Textarea";
import { Select } from "@/components/inputs/Select";
import { useMultisigPackageInfo } from "@/hooks/useMultisig";
import { cacheUpgradeBuildOutput, digestBytesToHex, parseUpgradeBuildOutput } from "@/lib/upgradeBuildCache";
import {
    addProvideObjectSpec,
    addUpgradeAndCommitSpecs,
    addRestrictSpec,
    addLockUpgradeCapSpec,
    addUnlockUpgradeCapSpec,
    addTransferObjectSpec,
    type ActionSpecBuilder,
} from "@/lib/sui/multisig-tx";
import { UpgradeBuildCommand } from "../UpgradeBuildCommand";

export interface UpgradeData {
    mode: "upgrade" | "restrict" | "lock_upgrade_cap" | "unlock_upgrade_cap";
    packageName: string;
    digest: string;
    policy: string;
    delayDays: string;
    expectedCapId: string;
    resourceName: string;
    recipient: string;
}

interface Props {
    accountId: string;
    data: UpgradeData;
    onChange: (data: UpgradeData) => void;
}

const MODE_OPTIONS = [
    { value: "upgrade", label: "Upgrade + Commit" },
    { value: "restrict", label: "Restrict Policy" },
    { value: "lock_upgrade_cap", label: "Lock UpgradeCap" },
    { value: "unlock_upgrade_cap", label: "Unlock & Transfer UpgradeCap" },
];

const POLICY_OPTIONS = [
    { value: "0", label: "Compatible" },
    { value: "128", label: "Additive" },
    { value: "255", label: "Immutable (Locked)" },
];

const PACKAGE_NAME_LABEL = "Package Name (for reference, correct type not needed)";

interface UpgradeCapInfo {
    objectId: string;
    packageId: string;
}

interface UpgradeCapFields {
    package?: string;
}

// --- Hooks ---

function useWalletUpgradeCaps() {
    const account = useCurrentAccount();
    const client = useSuiClient();
    const address = account?.address;

    return useQuery<UpgradeCapInfo[]>({
        queryKey: ["wallet-upgrade-caps", address],
        queryFn: async () => {
            if (!address) return [];
            const caps: UpgradeCapInfo[] = [];
            let cursor: string | null | undefined = null;
            while (true) {
                const page = await client.getOwnedObjects({
                    owner: address,
                    filter: { StructType: "0x2::package::UpgradeCap" },
                    options: { showContent: true },
                    ...(cursor ? { cursor } : {}),
                });
                for (const item of page.data) {
                    const content = item.data?.content;
                    if (content?.dataType !== "moveObject") continue;
                    const fields = content.fields as UpgradeCapFields;
                    caps.push({
                        objectId: item.data!.objectId,
                        packageId: fields?.package ?? "",
                    });
                }
                if (!page.hasNextPage || !page.nextCursor) break;
                cursor = page.nextCursor;
            }
            return caps;
        },
        enabled: !!address,
        staleTime: 30_000,
    });
}

// --- Component ---

export function UpgradeForm({ accountId, data, onChange }: Props) {
    const update = useCallback((patch: Partial<UpgradeData>) => onChange({ ...data, ...patch }), [data, onChange]);
    const { data: packageInfo = [], isLoading: isPackagesLoading } = useMultisigPackageInfo(accountId);
    const { data: walletCaps = [], isLoading: isCapsLoading } = useWalletUpgradeCaps();
    const [buildJsonRaw, setBuildJsonRaw] = useState("");
    const [buildJsonError, setBuildJsonError] = useState(false);

    const packageOptions = useMemo(
        () =>
            packageInfo.map((pkg) => ({
                value: pkg.name,
                label: `${pkg.name} — ${formatAddress(pkg.packageAddress)} — ${formatAddress(pkg.capObjectId)}`,
                capObjectId: pkg.capObjectId,
            })),
        [packageInfo]
    );
    const hasLockedPackageOptions = !isPackagesLoading && packageOptions.length > 0;

    const capOptions = useMemo(
        () =>
            walletCaps.map((cap) => ({
                value: cap.objectId,
                label: `${formatAddress(cap.packageId)} — ${formatAddress(cap.objectId)}`,
                packageId: cap.packageId,
            })),
        [walletCaps]
    );
    const selectedLockedPackage = useMemo(
        () => packageInfo.find((entry) => entry.name === data.packageName),
        [data.packageName, packageInfo]
    );

    useEffect(() => {
        if (data.mode === "lock_upgrade_cap" || !selectedLockedPackage) return;
        if (data.expectedCapId === selectedLockedPackage.capObjectId) return;
        update({ expectedCapId: selectedLockedPackage.capObjectId });
    }, [data.expectedCapId, data.mode, selectedLockedPackage, update]);

    const handleBuildJsonChange = (raw: string) => {
        setBuildJsonRaw(raw);
        if (!raw.trim()) {
            setBuildJsonError(false);
            update({ digest: "" });
            return;
        }
        const parsed = parseUpgradeBuildOutput(raw);
        if (parsed) {
            setBuildJsonError(false);
            const digest = digestBytesToHex(parsed.digest);
            cacheUpgradeBuildOutput(raw);
            update({ digest });
        } else {
            setBuildJsonError(true);
        }
    };

    const handleDelayDaysChange = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.startsWith("-")) {
            update({ delayDays: "0" });
            return;
        }
        const parsed = Number(trimmed);
        update({ delayDays: Number.isFinite(parsed) && parsed < 0 ? "0" : value });
    };

    const parsedBuild = buildJsonRaw.trim() ? parseUpgradeBuildOutput(buildJsonRaw) : null;

    return (
        <div className="space-y-3">
            <Select
                label="Mode"
                options={MODE_OPTIONS}
                value={data.mode}
                onChange={(v) => update({ mode: v as UpgradeData["mode"] })}
                allowSearch={false}
                allowClear={false}
            />

            {data.mode === "lock_upgrade_cap" ? (
                <>
                    {!isCapsLoading && capOptions.length > 0 ? (
                        <>
                            <Select
                                label="UpgradeCap from Wallet"
                                options={capOptions}
                                value={data.expectedCapId ?? ""}
                                onChange={(objectId) => {
                                    const cap = walletCaps.find((c) => c.objectId === objectId);
                                    if (cap) update({ expectedCapId: cap.objectId });
                                }}
                                allowSearch
                                allowClear={false}
                            />
                            <Input
                                label={PACKAGE_NAME_LABEL}
                                value={data.packageName}
                                onChange={(v) => update({ packageName: v })}
                                placeholder="my-package (will be locked under this name)"
                            />
                        </>
                    ) : (
                        <>
                            <Input
                                label={PACKAGE_NAME_LABEL}
                                value={data.packageName}
                                onChange={(v) => update({ packageName: v })}
                                placeholder="my-package (will be locked under this name)"
                            />
                            <Input
                                label="UpgradeCap Object ID"
                                value={data.expectedCapId ?? ""}
                                onChange={(v) => update({ expectedCapId: v })}
                                placeholder="0x... UpgradeCap object ID"
                                error={!!data.expectedCapId && !isValidSuiAddress(data.expectedCapId)}
                            />
                            {isCapsLoading && (
                                <p className="text-[11px] text-text-muted">Scanning wallet for UpgradeCaps...</p>
                            )}
                            {!isCapsLoading && capOptions.length === 0 && (
                                <p className="text-[11px] text-text-muted">
                                    No UpgradeCaps found in your wallet. Enter the UpgradeCap object ID manually.
                                </p>
                            )}
                        </>
                    )}
                    <Input
                        label="Minimum Upgrade Delay (days)"
                        type="number"
                        min={0}
                        step={1}
                        value={data.delayDays}
                        onChange={handleDelayDaysChange}
                        placeholder="0"
                    />
                    <p className="text-[11px] text-text-muted">
                        The executor must provide the UpgradeCap object when executing this intent. The cap will be
                        locked with the specified minimum upgrade delay.
                    </p>
                </>
            ) : !isPackagesLoading && packageOptions.length > 0 ? (
                <Select
                    label={PACKAGE_NAME_LABEL}
                    options={packageOptions}
                    value={data.packageName}
                    onChange={(v) => {
                        const pkg = packageInfo.find((entry) => entry.name === v);
                        update({ packageName: v, expectedCapId: pkg?.capObjectId ?? data.expectedCapId });
                    }}
                    allowSearch
                    allowClear={false}
                />
            ) : (
                <>
                    <Input
                        label={PACKAGE_NAME_LABEL}
                        value={data.packageName}
                        onChange={(v) => update({ packageName: v })}
                        placeholder="my-package"
                    />
                    {isPackagesLoading && <p className="text-[11px] text-text-muted">Loading packages...</p>}
                    {!isPackagesLoading && packageOptions.length === 0 && (
                        <p className="text-[11px] text-text-muted">
                            No locked UpgradeCaps found. Enter package name manually.
                        </p>
                    )}
                </>
            )}

            {data.mode !== "lock_upgrade_cap" && selectedLockedPackage && (
                <div className="rounded-lg border border-border-subtle bg-card-more-elevated/40 p-3 text-[11px] text-text-muted space-y-1">
                    <p>
                        Locked UpgradeCap:{" "}
                        <span className="font-mono text-text-primary">
                            {formatAddress(selectedLockedPackage.capObjectId)}
                        </span>
                    </p>
                    <p>
                        Package:{" "}
                        <span className="font-mono text-text-primary">
                            {formatAddress(selectedLockedPackage.packageAddress)}
                        </span>
                    </p>
                </div>
            )}

            {data.mode !== "lock_upgrade_cap" && !hasLockedPackageOptions && (
                <Input
                    label="UpgradeCap Object ID"
                    value={data.expectedCapId ?? ""}
                    onChange={(v) => update({ expectedCapId: v })}
                    placeholder="0x... locked UpgradeCap object ID"
                    error={!!data.expectedCapId && !isValidSuiAddress(data.expectedCapId)}
                />
            )}

            {data.mode === "upgrade" && (
                <>
                    <div className="text-[10px] text-text-muted p-2 rounded-lg bg-card-more-elevated/40 border border-border-subtle space-y-1">
                        <p className="font-medium text-text-secondary">Step 1 of 3: Generate build output</p>
                        <p>Run in your package directory:</p>
                        <UpgradeBuildCommand />
                        <p>Paste the JSON output below.</p>
                    </div>
                    <Textarea
                        label="Build output (step 2: paste here to propose)"
                        value={buildJsonRaw}
                        onChange={handleBuildJsonChange}
                        placeholder="Paste JSON output here"
                        rows={3}
                        error={buildJsonError}
                    />
                    {parsedBuild && (
                        <div className="text-[10px] text-text-muted space-y-0.5 p-2 rounded-lg bg-card-more-elevated/40 border border-border-subtle">
                            <div className="flex items-center gap-2">
                                <span className="text-green-400">Parsed</span>
                                <span>
                                    {parsedBuild.modules.length} module{parsedBuild.modules.length !== 1 ? "s" : ""}
                                </span>
                                <span>
                                    {parsedBuild.dependencies.length} dep
                                    {parsedBuild.dependencies.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="font-mono text-[9px] truncate">digest: {data.digest}</div>
                        </div>
                    )}
                    {buildJsonError && (
                        <p className="text-[10px] text-red-400">
                            Invalid build output. Expected JSON from: sui move build --dump-bytecode-as-base64
                        </p>
                    )}
                    {!buildJsonRaw.trim() && data.digest && (
                        <p className="text-[10px] text-text-muted font-mono truncate">digest: {data.digest}</p>
                    )}
                </>
            )}

            {data.mode === "restrict" && (
                <Select
                    label="Policy"
                    options={POLICY_OPTIONS}
                    value={data.policy}
                    onChange={(v) => update({ policy: v })}
                    allowSearch={false}
                    allowClear={false}
                />
            )}

            {data.mode === "unlock_upgrade_cap" && (
                <>
                    <Input
                        label="Transfer To (recipient address)"
                        value={data.recipient ?? ""}
                        onChange={(v) => update({ recipient: v })}
                        placeholder="0x... address to receive the UpgradeCap"
                        error={!!data.recipient && !isValidSuiAddress(data.recipient)}
                    />
                    <p className="text-[11px] text-text-muted">
                        Unlocks the UpgradeCap from the account and transfers it to the recipient address in a single
                        intent.
                    </p>
                </>
            )}
        </div>
    );
}

/** Parse hex string to byte array */
function hexToBytes(hex: string): number[] {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
        throw new Error("Digest must be an even-length hex string");
    }
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2) {
        bytes.push(parseInt(clean.substring(i, i + 2), 16));
    }
    return bytes;
}

function isValidHexDigest(input: string): boolean {
    const clean = input.startsWith("0x") ? input.slice(2) : input;
    return clean.length > 0 && clean.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(clean);
}

function daysToMs(days: string): bigint {
    const d = parseFloat(days || "0");
    return BigInt(Math.round(d * 86_400_000));
}

export function addUpgradeSpecs(tx: Transaction, builder: ActionSpecBuilder, data: UpgradeData) {
    if (data.mode === "upgrade") {
        addUpgradeAndCommitSpecs(tx, builder, data.packageName, hexToBytes(data.digest), data.expectedCapId);
    } else if (data.mode === "restrict") {
        addRestrictSpec(tx, builder, data.packageName, Number(data.policy), data.expectedCapId);
    } else if (data.mode === "unlock_upgrade_cap") {
        const resourceName = (data.resourceName ?? "").trim() || "upgrade_cap";
        addUnlockUpgradeCapSpec(tx, builder, data.packageName, resourceName, data.expectedCapId);
        addTransferObjectSpec(tx, builder, "0x2::package::UpgradeCap", data.recipient, resourceName);
    } else {
        const resourceName = `upgrade_cap_${data.expectedCapId}`;
        addProvideObjectSpec(tx, builder, "0x2::package::UpgradeCap", data.expectedCapId, resourceName);
        addLockUpgradeCapSpec(
            tx,
            builder,
            data.packageName,
            daysToMs(data.delayDays),
            resourceName,
            data.expectedCapId
        );
    }
}

export function validateUpgrade(data: UpgradeData): boolean {
    if (!data.packageName) return false;
    if (!isValidSuiAddress(data.expectedCapId)) return false;
    if (data.mode === "upgrade") return isValidHexDigest(data.digest);
    if (data.mode === "lock_upgrade_cap") return parseFloat(data.delayDays) >= 0;
    if (data.mode === "unlock_upgrade_cap") return isValidSuiAddress(data.recipient);
    return data.policy.length > 0;
}
