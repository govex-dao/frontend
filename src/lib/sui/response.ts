/** Accept Move JSON returned directly by gRPC or wrapped by legacy JSON-RPC. */
export function unwrapMoveFields<T>(value: T): T {
    return (value as T & { fields?: T })?.fields ?? value;
}

/** Convert the full address stored by Move TypeName into the SDK's short form. */
export function normalizeMoveCoinType(coinType: string): string {
    const trimmed = coinType.trim();
    if (!trimmed.includes("::")) return trimmed;
    const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    const parts = prefixed.split("::");
    const address = parts[0].replace(/^0x0+/, "0x") || "0x0";
    return `${address}::${parts.slice(1).join("::")}`;
}
