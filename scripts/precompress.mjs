import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

const outputDirectory = resolve(process.argv[2] ?? "dist");
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt", ".xml"]);
const minimumSize = 1024;

async function collectFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(path)));
        } else if (entry.isFile() && compressibleExtensions.has(extname(entry.name))) {
            files.push(path);
        }
    }

    return files;
}

const files = await collectFiles(outputDirectory);
let sourceBytes = 0;
let brotliBytes = 0;
let gzipBytes = 0;
let compressedFiles = 0;

for (const file of files) {
    const fileStat = await stat(file);
    if (fileStat.size < minimumSize) continue;

    const source = await readFile(file);
    const [brotliOutput, gzipOutput] = await Promise.all([
        brotli(source, {
            params: {
                [constants.BROTLI_PARAM_QUALITY]: 9,
                [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
            },
        }),
        gzipAsync(source, { level: 9 }),
    ]);

    await Promise.all([writeFile(`${file}.br`, brotliOutput), writeFile(`${file}.gz`, gzipOutput)]);
    sourceBytes += source.byteLength;
    brotliBytes += brotliOutput.byteLength;
    gzipBytes += gzipOutput.byteLength;
    compressedFiles += 1;
}

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(
    `Precompressed ${compressedFiles} files: ${formatKb(sourceBytes)} source, ${formatKb(brotliBytes)} Brotli, ${formatKb(gzipBytes)} gzip`
);
