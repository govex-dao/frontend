export interface BuildInfo {
    commit: string | null;
    commitShort: string | null;
    commitTime: string | null;
    buildTime: string;
    repo: string | null;
    branch: string | null;
    ciRunUrl: string | null;
    nodeVersion: string;
    pnpmLockHash: string | null;
    sourceDirty: boolean | null;
}

declare const __BUILD_INFO__: BuildInfo;

export const buildInfo = __BUILD_INFO__;
