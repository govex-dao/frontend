const STORAGE_PREFIX = "multisig-upgrade-build-output:";

export interface UpgradeBuildOutput {
  modules: string[];
  dependencies: string[];
  digest: number[];
}

export function parseUpgradeBuildOutput(raw: string): UpgradeBuildOutput | null {
  try {
    const data = JSON.parse(raw.trim());
    if (!Array.isArray(data.modules) || !Array.isArray(data.dependencies) || !Array.isArray(data.digest)) {
      return null;
    }
    return data as UpgradeBuildOutput;
  } catch {
    return null;
  }
}

export function digestBytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function storageKey(digestHex: string): string {
  const cleanDigest = digestHex.startsWith("0x") ? digestHex.slice(2) : digestHex;
  return `${STORAGE_PREFIX}${cleanDigest.toLowerCase()}`;
}

export function cacheUpgradeBuildOutput(raw: string): string | null {
  const parsed = parseUpgradeBuildOutput(raw);
  if (!parsed) return null;

  const digestHex = digestBytesToHex(parsed.digest);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(digestHex), raw.trim());
  }
  return digestHex;
}

export function getCachedUpgradeBuildOutput(digestHex: string): string | null {
  if (!digestHex || typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(digestHex));
}
