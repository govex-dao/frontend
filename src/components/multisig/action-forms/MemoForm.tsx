import type { Transaction } from "@mysten/sui/transactions";
import { Textarea } from "@/components/inputs/Textarea";
import { addMemoSpec, type ActionSpecBuilder } from "@/lib/sui/multisig-tx";

export interface MemoData {
    memo: string;
}

interface Props {
    data: MemoData;
    onChange: (data: MemoData) => void;
}

export function MemoForm({ data, onChange }: Props) {
    return (
        <div className="space-y-3">
            <Textarea
                label="Memo"
                value={data.memo}
                onChange={(v) => onChange({ memo: v })}
                placeholder="Record a message on-chain..."
                rows={3}
            />
        </div>
    );
}

export function addMemoSpecs(tx: Transaction, builder: ActionSpecBuilder, data: MemoData) {
    addMemoSpec(tx, builder, data.memo);
}

export function validateMemo(data: MemoData): boolean {
    return data.memo.length > 0;
}
