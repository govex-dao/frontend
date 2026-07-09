import { toRaiseView, type RaiseView } from "@/types/RaiseView";
import type { Raise } from "@/types/Raise";

export const EXAMPLE_RAISE_ID = "example";
export const EXAMPLE_RAISE_OBJECT_ID = "0x8f9d58b1e3270f67cb3575d9e7a06482de75f5f716e9ed4f5a6fe4ff4d7b3a91";
export const EXAMPLE_DAO_ACCOUNT_ID = "0xb9a2e874c06e45c6c6e04fa9f5bd49d7d01f3d537b179ade0bc98ab82cf3e0a7";

export const EXAMPLE_ASSET_TYPE =
    "0x8f9d58b1e3270f67cb3575d9e7a06482de75f5f716e9ed4f5a6fe4ff4d7b3a91::example_raise_token::DEMO";
export const EXAMPLE_STABLE_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

const DAY_MS = 86_400_000;
const STABLE_DECIMALS = 6;
const ASSET_DECIMALS = 6;

function rawUnits(amount: number, decimals: number): string {
    return Math.round(amount * 10 ** decimals).toString();
}

export interface ExampleContributor {
    address: string;
    name: string;
    amount: number;
    allocation: string;
}

export interface ExampleTimelineItem {
    label: string;
    detail: string;
    status: "complete" | "current" | "pending";
}

export interface ExampleAction {
    title: string;
    detail: string;
    packageLabel: string;
    status: "ready" | "queued";
}

export const exampleContributors: ExampleContributor[] = [
    {
        address: "0xa473dcbf37106d0642d608897a8dd8f8ea306cf7606e83e72433c839e9e45062",
        name: "Demo Contributor 01",
        amount: 420_000,
        allocation: "4.10%",
    },
    {
        address: "0x86de0cd32839733660f57e41066e9817b15c3e558e2f24359a2b78526fb27d2d",
        name: "Demo Contributor 02",
        amount: 315_000,
        allocation: "3.08%",
    },
    {
        address: "0x2cf24b3e4a60d0bc0a3641db3fcb60a633d3115a86e1c986f9e2e97f504833b5",
        name: "Demo Contributor 03",
        amount: 275_000,
        allocation: "2.68%",
    },
    {
        address: "0xf6bb0d526367c0786cfdbf8e89c8d42000b77f2e514d59d1c6fdd6c9e2f17df8",
        name: "Demo Contributor 04",
        amount: 188_500,
        allocation: "1.84%",
    },
    {
        address: "0x52c07e64eb54d006f2f01e7f4332df49831f4195879720f88445291a407dd6ff",
        name: "Demo Contributor 05",
        amount: 125_000,
        allocation: "1.22%",
    },
];

export const exampleTimeline: ExampleTimelineItem[] = [
    {
        label: "Raise created",
        detail: "Account setup, treasury vault, and transfer policy were staged atomically.",
        status: "complete",
    },
    {
        label: "Funding window",
        detail: "Public USDC contributions are open with contributor caps and reservation tracking.",
        status: "current",
    },
    {
        label: "Onchain settlement",
        detail: "The accepted amount is snapshotted and oversubscription refunds become claimable.",
        status: "pending",
    },
    {
        label: "DAO initialization",
        detail: "Success actions deposit funds, create liquidity, and activate vault controls.",
        status: "pending",
    },
];

export const exampleSuccessActions: ExampleAction[] = [
    {
        title: "Deposit accepted USDC",
        detail: "Move final accepted proceeds into the example DAO treasury vault.",
        packageLabel: "launchpad::deposit_raise_funds",
        status: "ready",
    },
    {
        title: "Create initial liquidity",
        detail: "Seed DEMO/USDC liquidity with minted example raise tokens after settlement.",
        packageLabel: "markets::create_pool_with_mint",
        status: "queued",
    },
    {
        title: "Install protective bid",
        detail: "Create a NAV bid wall funded by the treasury vault for downside liquidity.",
        packageLabel: "actions::create_protective_bid",
        status: "queued",
    },
];

export const exampleFailureActions: ExampleAction[] = [
    {
        title: "Unlock refunds",
        detail: "Contributors claim back USDC if the minimum raise is missed.",
        packageLabel: "launchpad::claim_refund",
        status: "queued",
    },
    {
        title: "Return issuer caps",
        detail: "Admin and mint capabilities return to the creator after failed cleanup.",
        packageLabel: "launchpad::cleanup_failed_raise",
        status: "queued",
    },
];

export function getExampleRaiseRaw(nowMs = Date.now()): Raise {
    return {
        id: EXAMPLE_RAISE_ID,
        dao_id: null,
        creator: "0xa914074096610d683c749a9de57a988272f9df5190e9c6191f86d91d7dd13072",
        asset_type: EXAMPLE_ASSET_TYPE,
        stable_type: EXAMPLE_STABLE_TYPE,
        asset_symbol: "DEMO",
        stable_symbol: "USDC",
        asset_decimals: ASSET_DECIMALS,
        stable_decimals: STABLE_DECIMALS,
        state: "funding",
        pool_id: null,
        lp_type: null,
        target_amount: rawUnits(750_000, STABLE_DECIMALS),
        min_raise_amount: rawUnits(750_000, STABLE_DECIMALS),
        max_raise_amount: rawUnits(2_500_000, STABLE_DECIMALS),
        raised: rawUnits(1_842_500, STABLE_DECIMALS),
        tokens_for_sale: rawUnits(18_000_000, ASSET_DECIMALS),
        start_time: String(nowMs - 8 * DAY_MS),
        deadline: String(nowMs + 4 * DAY_MS + 7 * 3_600_000),
        completion_started_ms: null,
        description:
            "Example raise showing Govex launchpad funding, settlement, and DAO-controlled treasury execution.",
        metadata: {
            name: "Example Raise",
            image: "/images/raises/example-raise-icon.png",
            header_image: "/images/raises/example-raise-hero.png",
            about: "This example raise shows how a launchpad campaign can stage treasury actions, transfer controls, and post-raise liquidity in one onchain flow.",
            team: JSON.stringify([
                { name: "Example Founder", role: "Demo role" },
                { name: "Example Operator", role: "Demo role" },
                { name: "Example Finance Lead", role: "Demo role" },
            ]),
            website: "https://example.com",
        },
        timestamp: String(nowMs - 8 * DAY_MS),
        contributor_count: 612,
        contributors: exampleContributors.map((contributor) => ({
            address: contributor.address,
            amount: rawUnits(contributor.amount, STABLE_DECIMALS),
            percentage: ((contributor.amount / 1_842_500) * 100).toFixed(2),
        })),
        reservations: [
            {
                wallet: "0x40bb5158478dc07f16616edcfa7d20b1ed9f77730d15abb4ba7f1026e520bf6e",
                amount: rawUnits(125_000, STABLE_DECIMALS),
                accepted: false,
            },
        ],
        success_actions: exampleSuccessActions,
        failure_actions: exampleFailureActions,
    };
}

export function getExampleRaiseView(nowMs = Date.now()): RaiseView {
    return toRaiseView(getExampleRaiseRaw(nowMs));
}
