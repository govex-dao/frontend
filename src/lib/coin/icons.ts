import { SUI_TYPE_ARG } from "@mysten/sui/utils";

const USDC_COIN_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
export const SUI_ICON_PATH = "/images/tokens/sui.png";
export const USDC_ICON_PATH = "/images/tokens/usdc.png";
export const GOVEX_ICON_PATH = "/images/govex-icon.png";

function normalizeCoinType(coinType?: string | null): string | undefined {
    const trimmed = coinType?.trim();
    if (!trimmed) return undefined;

    const parts = trimmed.split("::");
    if (parts.length < 3) return trimmed.toLowerCase();

    const rawAddress = parts[0].toLowerCase().startsWith("0x") ? parts[0].slice(2) : parts[0];
    const address = rawAddress.replace(/^0+/, "") || "0";
    return `0x${address.toLowerCase()}::${parts.slice(1).join("::").toLowerCase()}`;
}

const SUI_COIN_TYPE_KEY = normalizeCoinType(SUI_TYPE_ARG) ?? SUI_TYPE_ARG.toLowerCase();
const USDC_COIN_TYPE_KEY = normalizeCoinType(USDC_COIN_TYPE) ?? USDC_COIN_TYPE.toLowerCase();

const KNOWN_COIN_TYPE_ICONS: Record<string, string> = {
    [SUI_COIN_TYPE_KEY]: SUI_ICON_PATH,
    [USDC_COIN_TYPE_KEY]: USDC_ICON_PATH,
};

const KNOWN_SYMBOL_ICONS: Record<string, string> = {
    SUI: SUI_ICON_PATH,
    USDC: USDC_ICON_PATH,
    GOVEX: GOVEX_ICON_PATH,
};

function normalizeSymbol(symbol?: string | null): string | undefined {
    const trimmed = symbol?.trim();
    return trimmed ? trimmed.toUpperCase() : undefined;
}

export function getKnownCoinIcon(options: { coinType?: string | null; symbol?: string | null }): string | undefined {
    const coinType = normalizeCoinType(options.coinType);
    if (coinType && KNOWN_COIN_TYPE_ICONS[coinType]) {
        return KNOWN_COIN_TYPE_ICONS[coinType];
    }

    const symbol = normalizeSymbol(options.symbol);
    return symbol ? KNOWN_SYMBOL_ICONS[symbol] : undefined;
}

export function isSuiCoin(options: { coinType?: string | null; symbol?: string | null }): boolean {
    return normalizeCoinType(options.coinType) === SUI_COIN_TYPE_KEY || normalizeSymbol(options.symbol) === "SUI";
}

export function resolveCoinIcon(options: {
    coinType?: string | null;
    symbol?: string | null;
    iconUrl?: string | null;
}): string {
    return getKnownCoinIcon(options) ?? options.iconUrl ?? "";
}
