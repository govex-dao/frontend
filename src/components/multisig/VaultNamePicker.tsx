import { useMemo } from "react";
import { Select } from "@/components/inputs/Select";
import { Input } from "@/components/inputs/Input";
import { useMultisigVaultNames } from "@/hooks/useMultisig";

interface Props {
    accountId: string;
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

export function VaultNamePicker({ accountId, value, onChange, label = "Vault Name" }: Props) {
    const { data: vaultNames = [], isLoading } = useMultisigVaultNames(accountId);
    const options = useMemo(() => vaultNames.map((name) => ({ value: name, label: name })), [vaultNames]);

    if (!isLoading && options.length > 0) {
        return (
            <Select label={label} options={options} value={value} onChange={onChange} allowSearch allowClear={false} />
        );
    }

    return (
        <>
            <Input label={label} value={value} onChange={onChange} placeholder="main-treasury" />
            {isLoading && <p className="text-[11px] text-text-muted">Loading vaults...</p>}
        </>
    );
}
