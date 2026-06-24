import { Textarea } from "@/components/inputs/Textarea";

interface Props {
    value: string;
    onChange: (value: string) => void;
}

export function MemoForm(props: Props) {
    const { value, onChange } = props;
    return (
        <div className="space-y-1.5 w-full">
            <Textarea
                label=""
                value={value}
                onChange={onChange}
                placeholder="What message should be recorded onchain?"
                rows={3}
                className="bg-card-elevated! focus:bg-card-more-elevated!"
            />
            {!value && (
                <div className="px-2 py-1.5 bg-yellow-400/5 border-l-2 border-yellow-400/30 rounded text-xs text-text-muted italic">
                    💡 Share context, instructions, or rationale for this decision
                </div>
            )}
        </div>
    );
}
