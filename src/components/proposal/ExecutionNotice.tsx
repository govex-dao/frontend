import { Timer } from "lucide-react";
import { Card } from "@/components/Card";

interface ExecutionNoticeProps {
    /** Digital countdown string e.g. "00:28:15" */
    countdown: string;
    /** Whether the execution window has expired */
    expired: boolean;
}

export function ExecutionNotice({ countdown, expired }: ExecutionNoticeProps) {
    return (
        <Card className="shrink-0 border border-border-light rounded-2xl overflow-hidden relative bg-linear-to-br from-amber-500/10 via-amber-500/5 to-amber-600/10">
            <div className="relative z-10 p-4 sm:p-5 flex items-center gap-4">
                <div className="relative shrink-0">
                    <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-400/20">
                        <Timer className="w-6 h-6 text-amber-400/80" />
                    </div>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] uppercase tracking-widest text-text-tertiary/70">
                        {expired ? "Execution Window Ended" : "Execution Window Ends In"}
                    </span>
                    <span
                        className={`font-mono tabular-nums text-2xl tracking-[0.08em] font-bold ${
                            expired ? "text-amber-400/60" : "text-white"
                        }`}
                    >
                        {countdown}
                    </span>
                    <span className="text-[10px] text-text-tertiary/50">
                        {expired
                            ? "Awaiting finalization"
                            : "Trading still open during execution"}
                    </span>
                </div>
            </div>
        </Card>
    );
}
