const MAX_IMAGE_URL_LENGTH = 512;
const REMOTE_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const LOCAL_IMAGE_EXTENSIONS = [...REMOTE_IMAGE_EXTENSIONS, ".svg"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);
const PRIVATE_HOST_PATTERNS = [/^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^169\.254\./];

export const LINKED_IMAGE_HELP_TEXT = "Use an HTTPS PNG, JPG, or WebP under 1 MB. Keep the URL under 512 characters.";

function hasAllowedExtension(pathname: string, extensions: string[]): boolean {
    const normalized = pathname.toLowerCase();
    return extensions.some((extension) => normalized.endsWith(extension));
}

function pathWithoutQuery(value: string): string {
    return value.split(/[?#]/)[0] ?? value;
}

export function validateLinkedImageUrl(
    value: string,
    options: { allowRelative?: boolean } = {}
): { normalized: string | null; error?: string } {
    const raw = value.trim();
    if (!raw) return { normalized: null };

    if (raw.length > MAX_IMAGE_URL_LENGTH) {
        return { normalized: null, error: "Image URL must be 512 characters or shorter" };
    }

    if (options.allowRelative && raw.startsWith("/") && !raw.startsWith("//")) {
        const pathname = pathWithoutQuery(raw);
        if (!hasAllowedExtension(pathname, LOCAL_IMAGE_EXTENSIONS)) {
            return { normalized: null, error: "Use a PNG, JPG, WebP, or local SVG image" };
        }
        return { normalized: raw };
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProtocol);
        if (url.protocol !== "https:") {
            return { normalized: null, error: "Use an HTTPS image URL" };
        }
        if (url.username || url.password) {
            return { normalized: null, error: "Image URL must not include credentials" };
        }
        const hostname = url.hostname.toLowerCase();
        if (!hostname.includes(".")) {
            return { normalized: null, error: "Enter a valid image URL" };
        }
        if (BLOCKED_HOSTNAMES.has(hostname) || PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
            return { normalized: null, error: "Image URL host is not allowed" };
        }
        if (!hasAllowedExtension(url.pathname, REMOTE_IMAGE_EXTENSIONS)) {
            return { normalized: null, error: "Use a PNG, JPG, or WebP image URL" };
        }
        return { normalized: url.toString() };
    } catch {
        return { normalized: null, error: "Enter a valid image URL" };
    }
}
