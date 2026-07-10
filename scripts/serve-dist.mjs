import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const distDirectory = resolve(process.env.STATIC_DIR ?? "dist");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const contentTypes = new Map([
    [".css", "text/css; charset=utf-8"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "application/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".txt", "text/plain; charset=utf-8"],
    [".webp", "image/webp"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
    [".xml", "application/xml; charset=utf-8"],
]);

function loadConfiguredHeaders() {
    try {
        const config = JSON.parse(readFileSync(resolve("serve.json"), "utf8"));
        const globalRule = config.headers?.find((rule) => rule.source === "**");
        return Object.fromEntries(globalRule?.headers?.map(({ key, value }) => [key, value]) ?? []);
    } catch (error) {
        console.warn(`Could not load serve.json headers: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }
}

const configuredHeaders = loadConfiguredHeaders();

function acceptsEncoding(header, target) {
    if (!header) return false;

    return header.split(",").some((part) => {
        const [encoding, ...parameters] = part.trim().toLowerCase().split(";");
        if (encoding !== target && encoding !== "*") return false;
        const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
        return quality ? Number.parseFloat(quality.split("=")[1]) > 0 : true;
    });
}

function resolveRequestPath(pathname) {
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const requestedPath = resolve(distDirectory, relativePath);
    const isInsideDist = requestedPath === distDirectory || requestedPath.startsWith(`${distDirectory}${sep}`);
    if (!isInsideDist) return null;

    if (existsSync(requestedPath) && statSync(requestedPath).isFile()) return requestedPath;
    if (!extname(pathname)) return resolve(distDirectory, "index.html");
    return null;
}

function selectRepresentation(filePath, acceptEncoding) {
    if (acceptsEncoding(acceptEncoding, "br") && existsSync(`${filePath}.br`)) {
        return { path: `${filePath}.br`, encoding: "br" };
    }
    if (acceptsEncoding(acceptEncoding, "gzip") && existsSync(`${filePath}.gz`)) {
        return { path: `${filePath}.gz`, encoding: "gzip" };
    }
    return { path: filePath, encoding: null };
}

const server = createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Method not allowed");
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
        response.writeHead(400);
        response.end("Bad request");
        return;
    }

    const filePath = resolveRequestPath(pathname);
    if (!filePath || !existsSync(filePath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    const representation = selectRepresentation(filePath, request.headers["accept-encoding"]);
    const fileStat = statSync(representation.path);
    const originalExtension = extname(filePath).toLowerCase();
    const etag = `W/\"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}-${representation.encoding ?? "identity"}\"`;

    for (const [key, value] of Object.entries(configuredHeaders)) response.setHeader(key, value);
    response.setHeader("Content-Type", contentTypes.get(originalExtension) ?? "application/octet-stream");
    response.setHeader("Content-Length", fileStat.size);
    response.setHeader("ETag", etag);
    response.setHeader("Last-Modified", fileStat.mtime.toUTCString());
    response.setHeader("Vary", "Accept-Encoding");

    if (representation.encoding) response.setHeader("Content-Encoding", representation.encoding);

    if (pathname.startsWith("/assets/")) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (originalExtension === ".html") {
        response.setHeader("Cache-Control", "no-cache");
    } else {
        response.setHeader("Cache-Control", "public, max-age=3600");
    }

    if (request.headers["if-none-match"] === etag) {
        response.writeHead(304);
        response.end();
        return;
    }

    response.writeHead(200);
    if (request.method === "HEAD") {
        response.end();
        return;
    }

    const stream = createReadStream(representation.path);
    stream.on("error", (error) => {
        console.error(`Failed to stream ${representation.path}:`, error);
        if (!response.headersSent) response.writeHead(500);
        response.end();
    });
    stream.pipe(response);
});

server.listen(port, host, () => {
    console.log(`Serving ${distDirectory} on http://${host}:${port}`);
});
