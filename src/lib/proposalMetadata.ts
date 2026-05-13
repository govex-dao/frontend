type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function cleanStringArray(value: unknown): string | null {
    if (!Array.isArray(value)) return null;
    const parts = value.map(cleanString).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join("\n\n") : null;
}

function cleanText(value: unknown): string | null {
    return cleanString(value) ?? cleanStringArray(value);
}

export function proposalMetadataDescription(metadata: string | null | undefined): string {
    const raw = cleanString(metadata);
    if (!raw) return "";

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return raw;

        return (
            cleanText(parsed.details) ??
            cleanText(parsed.description) ??
            cleanText(parsed.summary) ??
            cleanText(parsed.rationale) ??
            cleanText(parsed.introduction) ??
            ""
        );
    } catch {
        return raw;
    }
}
