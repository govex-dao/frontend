import { MAX_ACTION_SPECS_PER_INTENT } from "@/lib/sui/multisig-tx";
import type { CapMigrationMode } from "./types";

export const GAS_RESERVE_MIST = 50_000_000n;
export const COIN_OBJECT_PAGE_LIMIT = 50;
export const MAX_COIN_OBJECTS_PER_DEPOSIT = 256;
export const MAX_MIGRATION_COIN_TYPES = 16;
export const MAX_MIGRATION_OBJECT_INPUTS = 512;
export const MAX_MIGRATION_ESTIMATED_COMMANDS = 450;
export const UPGRADE_CAP_TYPE = "0x2::package::UpgradeCap";
export const LOCKABLE_CAPS_PER_INTENT = Math.max(1, Math.floor(MAX_ACTION_SPECS_PER_INTENT / 2));
export const DEFAULT_UPGRADE_DELAY_DAYS = "0";

export const CAP_MODE_OPTIONS: Array<{ value: CapMigrationMode; label: string }> = [
    { value: "lock", label: "Add as controlled cap (finer grained control over usage)" },
    { value: "move", label: "Add as raw object" },
];
