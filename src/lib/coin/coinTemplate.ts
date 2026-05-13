/**
 * Pre-compiled Sui Move coin template bytecode
 *
 * This template contains placeholder values that can be modified using
 * @mysten/move-bytecode-template before deployment.
 *
 * Template constants:
 * - DECIMALS: 6 (u8)
 * - SYMBOL: "TMPL" (vector<u8>)
 * - NAME: "Template Coin" (vector<u8>)
 * - DESCRIPTION: "A template coin for Sui" (vector<u8>)
 * - ICON_URL: "https://example.com/icon.png" (vector<u8>)
 *
 * Module/struct identifiers to replace:
 * - coin_template (module name)
 * - COIN_TEMPLATE (struct name)
 */
export const COIN_TEMPLATE_BYTECODE =
    "oRzrCwYAAAAKAQAMAgwkAzA9BG0OBXuUAQePAuUBCPQDYAbUBFcKqwUFDLAFTAAJAQ8CCAIUAhUCFgAAAgABAwcBAAACAQwBAAECAgwBAAECBAwBAAEEBQIABQYHAAAMAAEAAA0CAQAABwMEAAETCAkBAAIHFQQBAAIKCwwBAgINEhMBAAMQCAEBDAMREQEBDAQSDg8ABQ4GBwADBwUKBw0IEAYKCBQECgIIAAcIBQAEBwsEAQgAAwUHCAUCBwsEAQgACwIBCAABAwILAwEIAAsEAQgAAQoCAQgGAQkAAQsBAQkAAQgABwkAAgoCCgIKAgsBAQgGBwgFAgsEAQkACwMBCQABCwMBCAABBggFAQUBCwQBCAACCQAFAwcLBAEJAAMHCAUBCwIBCQABCwIBCAACBwsEAQkACwIBCQANQ09JTl9URU1QTEFURQRDb2luDENvaW5NZXRhZGF0YQZPcHRpb24LVHJlYXN1cnlDYXAJVHhDb250ZXh0A1VybARidXJuBGNvaW4NY29pbl90ZW1wbGF0ZQ9jcmVhdGVfY3VycmVuY3kLZHVtbXlfZmllbGQEaW5pdARtaW50FW5ld191bnNhZmVfZnJvbV9ieXRlcwZvcHRpb24UcHVibGljX2ZyZWV6ZV9vYmplY3QPcHVibGljX3RyYW5zZmVyBnNlbmRlcgRzb21lCHRyYW5zZmVyCnR4X2NvbnRleHQDdXJsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgEGCgIFBFRNUEwKAg4NVGVtcGxhdGUgQ29pbgoCGBdBIHRlbXBsYXRlIGNvaW4gZm9yIFN1aQoCHRxodHRwczovL2V4YW1wbGUuY29tL2ljb24ucG5nAAIBCwEAAAAABRQLAAcABwEHAgcDBwQRCjgACgE4AQwCDAMLAjgCCwMLAS4RCTgDAgEBBAABBwsACwELAzgECwI4BQICAQQAAQQLAAsBOAYCAA==";

/**
 * Template default values (for reference and validation)
 */
export const TEMPLATE_DEFAULTS = {
    decimals: 6,
    symbol: "TMPL",
    name: "Template Coin",
    description: "A template coin for Sui",
    iconUrl: "https://example.com/icon.png",
    moduleName: "coin_template",
    structName: "COIN_TEMPLATE",
} as const;

/**
 * Dependencies required for the coin package
 */
export const COIN_TEMPLATE_DEPENDENCIES = [
    "0x0000000000000000000000000000000000000000000000000000000000000001", // Sui Framework
    "0x0000000000000000000000000000000000000000000000000000000000000002", // Move Stdlib
];
