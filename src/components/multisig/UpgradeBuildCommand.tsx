import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";

export const UPGRADE_BUILD_COMMAND =
    "sui move build --dump-bytecode-as-base64 --path ./your-package | grep '^{' | pbcopy";

interface Props {
    codeClassName?: string;
}

export function UpgradeBuildCommand({ codeClassName = "" }: Props) {
    const [copied, setCopied] = useState(false);

    const copyCommand = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(UPGRADE_BUILD_COMMAND);
            setCopied(true);
            toast.success("Build command copied", { id: "clipboard-copy" });
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Could not copy command");
        }
    }, []);

    return (
        <div className="flex min-w-0 items-stretch gap-1.5">
            <button
                type="button"
                onClick={copyCommand}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border-subtle bg-card-more-elevated/60 text-text-muted transition-colors hover:border-border-light hover:text-text-primary"
                title="Copy build command"
                aria-label="Copy build command"
            >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <code
                className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-card-more-elevated/60 px-1.5 py-1 font-mono text-[9px] select-all ${codeClassName}`}
            >
                {UPGRADE_BUILD_COMMAND}
            </code>
        </div>
    );
}
