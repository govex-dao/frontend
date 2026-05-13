import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";

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

export interface BuildInfoFile extends BuildInfo {
    distSha256: string | null;
}

function readEnv(name: string): string | null {
    const value = process.env[name]?.trim();
    return value ? value : null;
}

function firstValue(values: Array<string | null | undefined>): string | null {
    return values.find((value) => value !== null && value !== undefined && value.length > 0) ?? null;
}

function readCommand(args: string[]): string | null {
    try {
        const value = execFileSync("git", args, {
            cwd: process.cwd(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return value || null;
    } catch {
        return null;
    }
}

function normalizeRepoUrl(value: string | null): string | null {
    if (!value) return null;

    const githubSlug = value.match(/^([\w.-]+\/[\w.-]+)$/);
    if (githubSlug) return `https://github.com/${githubSlug[1]}`;

    const sshGithub = value.match(/^git@github\.com:(.+?)(?:\.git)?$/);
    if (sshGithub) return `https://github.com/${sshGithub[1]}`;

    try {
        const url = new URL(value);
        url.username = "";
        url.password = "";
        const sanitized = url.toString().replace(/\/$/, "");
        return sanitized.endsWith(".git") ? sanitized.slice(0, -4) : sanitized;
    } catch {
        return null;
    }
}

function hashFile(filePath: string): string | null {
    if (!existsSync(filePath)) return null;

    const hash = createHash("sha256");
    hash.update(readFileSync(filePath));
    return `sha256:${hash.digest("hex")}`;
}

function readGitDirty(): boolean | null {
    const status = readCommand(["status", "--porcelain", "--untracked-files=all"]);
    if (status === null) return null;
    return status.length > 0;
}

function readBranch(): string | null {
    const branch = firstValue([
        readEnv("GITHUB_REF_NAME"),
        readEnv("VERCEL_GIT_COMMIT_REF"),
        readEnv("RAILWAY_GIT_BRANCH"),
        readEnv("BRANCH_NAME"),
        readEnv("COMMIT_REF"),
        readCommand(["rev-parse", "--abbrev-ref", "HEAD"]),
    ]);

    return branch === "HEAD" ? null : branch;
}

function readCiRunUrl(): string | null {
    const explicitUrl = readEnv("CI_RUN_URL");
    if (explicitUrl) return explicitUrl;

    const githubRunId = readEnv("GITHUB_RUN_ID");
    const githubRepo = readEnv("GITHUB_REPOSITORY");
    const githubServerUrl = readEnv("GITHUB_SERVER_URL") ?? "https://github.com";
    if (githubRunId && githubRepo) return `${githubServerUrl}/${githubRepo}/actions/runs/${githubRunId}`;

    return readEnv("BUILD_URL");
}

export function createBuildInfo(): BuildInfo {
    const commit = firstValue([
        readEnv("GITHUB_SHA"),
        readEnv("VERCEL_GIT_COMMIT_SHA"),
        readEnv("RAILWAY_GIT_COMMIT_SHA"),
        readEnv("COMMIT_SHA"),
        readEnv("SOURCE_COMMIT"),
        readCommand(["rev-parse", "HEAD"]),
    ]);
    const repo = normalizeRepoUrl(
        firstValue([
            readEnv("GITHUB_REPOSITORY"),
            readEnv("VERCEL_GIT_REPO_SLUG"),
            readCommand(["config", "--get", "remote.origin.url"]),
        ])
    );

    return {
        commit,
        commitShort: commit ? commit.slice(0, 12) : null,
        commitTime: commit
            ? readCommand(["show", "-s", "--format=%cI", commit])
            : readCommand(["log", "-1", "--format=%cI"]),
        buildTime: new Date().toISOString(),
        repo,
        branch: readBranch(),
        ciRunUrl: readCiRunUrl(),
        nodeVersion: process.version,
        pnpmLockHash: hashFile(path.resolve(process.cwd(), "pnpm-lock.yaml")),
        sourceDirty: readGitDirty(),
    };
}

function readFilesRecursive(
    rootDirectory: string,
    excludedRelativePaths: Set<string>,
    currentDirectory = rootDirectory
): string[] {
    if (!existsSync(currentDirectory)) return [];

    const files: string[] = [];
    for (const entry of readdirSync(currentDirectory)) {
        const absolutePath = path.join(currentDirectory, entry);
        const relativePath = path.relative(rootDirectory, absolutePath).replaceAll(path.sep, "/");
        if (excludedRelativePaths.has(relativePath)) continue;

        const stat = statSync(absolutePath);
        if (stat.isDirectory()) {
            files.push(...readFilesRecursive(rootDirectory, excludedRelativePaths, absolutePath));
            continue;
        }

        if (stat.isFile()) files.push(relativePath);
    }

    return files.sort();
}

function hashDistDirectory(directory: string): string | null {
    const files = readFilesRecursive(directory, new Set(["build.json"]));
    if (files.length === 0) return null;

    const hash = createHash("sha256");
    for (const relativePath of files) {
        hash.update(relativePath);
        hash.update("\0");
        hash.update(readFileSync(path.join(directory, relativePath)));
        hash.update("\0");
    }

    return `sha256:${hash.digest("hex")}`;
}

function writeBuildInfoFile(directory: string, buildInfo: BuildInfo): void {
    mkdirSync(directory, { recursive: true });
    const payload: BuildInfoFile = {
        ...buildInfo,
        distSha256: hashDistDirectory(directory),
    };

    writeFileSync(path.join(directory, "build.json"), `${JSON.stringify(payload, null, 2)}\n`);
}

export function buildInfoPlugin(buildInfo: BuildInfo): Plugin {
    let config: ResolvedConfig | null = null;

    return {
        name: "govex-build-info",
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const url = request.url?.split("?")[0];
                if (url !== "/build.json") {
                    next();
                    return;
                }

                const payload: BuildInfoFile = { ...buildInfo, distSha256: null };
                response.statusCode = 200;
                response.setHeader("Content-Type", "application/json; charset=utf-8");
                response.setHeader("Cache-Control", "no-store");
                response.end(`${JSON.stringify(payload, null, 2)}\n`);
            });
        },
        closeBundle() {
            if (!config) return;

            const outDir = path.isAbsolute(config.build.outDir)
                ? config.build.outDir
                : path.resolve(config.root, config.build.outDir);
            writeBuildInfoFile(outDir, buildInfo);
        },
    };
}
