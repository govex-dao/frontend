import type { SuiClient, SuiObjectResponse } from "@govex/futarchy-sdk";

export interface DynamicFieldInfo {
    name: unknown;
    objectId?: string;
    objectType?: string;
}

const inFlightReads = new WeakMap<object, Map<string, Promise<unknown>>>();
const recentReads = new WeakMap<object, Map<string, { expiresAt: number; value: unknown }>>();
const RECENT_READ_TTL_MS = 1_500;
const MAX_RECENT_READS_PER_CLIENT = 500;

export function coalesceChainRead<T>(
    client: SuiClient,
    key: string,
    load: () => Promise<T>,
    recentTtlMs = RECENT_READ_TTL_MS
): Promise<T> {
    const recent = recentReads.get(client as object);
    const cached = recent?.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T);
    if (cached) recent?.delete(key);

    let reads = inFlightReads.get(client as object);
    if (!reads) {
        reads = new Map();
        inFlightReads.set(client as object, reads);
    }

    const existing = reads.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const request = load();
    reads.set(key, request);
    const clear = () => {
        if (reads?.get(key) === request) reads.delete(key);
    };
    void request.then((value) => {
        let completed = recentReads.get(client as object);
        if (!completed) {
            completed = new Map();
            recentReads.set(client as object, completed);
        }
        if (completed.size >= MAX_RECENT_READS_PER_CLIENT) {
            const now = Date.now();
            for (const [completedKey, entry] of completed) {
                if (entry.expiresAt <= now) completed.delete(completedKey);
            }
            while (completed.size >= MAX_RECENT_READS_PER_CLIENT) {
                const oldestKey = completed.keys().next().value as string | undefined;
                if (!oldestKey) break;
                completed.delete(oldestKey);
            }
        }
        completed.set(key, { expiresAt: Date.now() + recentTtlMs, value });
        clear();
    }, clear);
    return request;
}

export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                results[index] = await mapper(items[index], index);
            }
        })
    );
    return results;
}

export function dynamicFieldReadKey(parentId: string, name: unknown): string {
    try {
        return `dynamic-field:${parentId}:${JSON.stringify(name)}`;
    } catch {
        return `dynamic-field:${parentId}:${String(name)}`;
    }
}

export function getAllDynamicFields(client: SuiClient, parentId: string): Promise<DynamicFieldInfo[]> {
    return coalesceChainRead(client, `dynamic-fields:${parentId}`, async () => {
        const all: DynamicFieldInfo[] = [];
        let cursor: string | null | undefined = null;

        while (true) {
            const page = await client.getDynamicFields({
                parentId,
                ...(cursor ? { cursor } : {}),
            });
            all.push(...(page.data as DynamicFieldInfo[]));
            if (!page.hasNextPage || !page.nextCursor) break;
            cursor = page.nextCursor;
        }

        return all;
    });
}

export async function getDynamicFieldObjects(
    client: SuiClient,
    parentId: string,
    fields: DynamicFieldInfo[]
): Promise<SuiObjectResponse[]> {
    if (fields.length === 0) return [];
    if (!fields.every((field) => field.objectId)) {
        return mapWithConcurrency(fields, 4, (field) =>
            coalesceChainRead(client, dynamicFieldReadKey(parentId, field.name), () =>
                client.getDynamicFieldObject({ parentId, name: field.name as never })
            )
        );
    }

    return getObjectsByIds(
        client,
        fields.map((field) => field.objectId!)
    );
}

export async function getObjectsByIds(client: SuiClient, objectIds: readonly string[]): Promise<SuiObjectResponse[]> {
    const ids = objectIds.filter(Boolean);
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let index = 0; index < ids.length; index += 50) chunks.push(ids.slice(index, index + 50));
    const pages = await mapWithConcurrency(chunks, 2, (chunk) =>
        coalesceChainRead(client, `objects:${chunk.join(",")}`, () =>
            client.multiGetObjects({
                ids: chunk,
                options: { showContent: true, showType: true },
            })
        )
    );
    return pages.flat();
}

export function getAllOwnedObjects(
    client: SuiClient,
    owner: string,
    structType?: string
): Promise<SuiObjectResponse[]> {
    const key = `owned-objects:${owner}:${structType ?? "*"}`;
    return coalesceChainRead(client, key, async () => {
        const all: SuiObjectResponse[] = [];
        let cursor: string | null | undefined = null;

        while (true) {
            const page = await client.getOwnedObjects({
                owner,
                options: { showContent: true, showType: true },
                ...(structType ? { filter: { StructType: structType } } : {}),
                ...(cursor ? { cursor } : {}),
            });
            all.push(...page.data);
            if (!page.hasNextPage || !page.nextCursor) break;
            cursor = page.nextCursor;
        }

        return all;
    });
}

export function getCoinMetadata(client: SuiClient, coinType: string) {
    return coalesceChainRead(client, `coin-metadata:${coinType}`, () => client.getCoinMetadata({ coinType }));
}
