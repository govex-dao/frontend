import { useMemo } from "react";
import { formatAddress, parseStructTag } from "@mysten/sui/utils";
import { Select } from "@/components/inputs/Select";
import { Input } from "@/components/inputs/Input";
import { useMultisigOwnedObjects } from "@/hooks/useMultisig";

interface Props {
  accountId: string;
  value: string;
  onChange: (objectId: string, objectType: string, isDerived: boolean) => void;
  label?: string;
  /** Only show objects whose type contains this string (e.g. "0x2::coin::Coin") */
  typeFilter?: string;
}

function shortType(fullType: string): string {
  try {
    const tag = parseStructTag(fullType);
    const addr = formatAddress(tag.address);
    let short = `${addr}::${tag.module}::${tag.name}`;
    if (tag.typeParams.length > 0) {
      const params = tag.typeParams.map((tp) => {
        if (typeof tp === "string") return tp;
        const p = tp as { address: string; module: string; name: string };
        return `${formatAddress(p.address)}::${p.module}::${p.name}`;
      });
      short += `<${params.join(", ")}>`;
    }
    return short;
  } catch {
    return fullType.length > 60 ? fullType.slice(0, 57) + "..." : fullType;
  }
}

export function OwnedObjectPicker({ accountId, value, onChange, label = "Object", typeFilter }: Props) {
  const { data: objects = [], isLoading } = useMultisigOwnedObjects(accountId);

  const filtered = useMemo(() => {
    if (!typeFilter) return objects;
    return objects.filter((obj) => obj.objectType.includes(typeFilter));
  }, [objects, typeFilter]);

  const options = useMemo(
    () =>
      filtered.map((obj) => ({
        value: obj.objectId,
        label: `${formatAddress(obj.objectId)} — ${shortType(obj.objectType)}`,
      })),
    [filtered],
  );

  const objectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const obj of filtered) {
      map.set(obj.objectId, obj.objectType);
    }
    return map;
  }, [filtered]);

  if (!isLoading && options.length > 0) {
    return (
      <Select
        label={label}
        options={options}
        value={value}
        onChange={(id) => onChange(id, objectMap.get(id) ?? "", true)}
        placeholder="Select an object..."
        allowSearch
        allowClear={false}
      />
    );
  }

  return (
    <>
      <Input
        label={label}
        value={value}
        onChange={(v) => onChange(v, "", false)}
        placeholder="0x... object ID"
      />
      {isLoading && (
        <p className="text-[11px] text-text-muted">Loading account objects...</p>
      )}
      {!isLoading && options.length === 0 && (
        <p className="text-[11px] text-text-muted">No matching objects found on account — paste ID manually</p>
      )}
    </>
  );
}
