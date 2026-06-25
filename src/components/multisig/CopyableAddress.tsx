import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";

const ELLIPSIS = "...";

let measureCanvas: HTMLCanvasElement | null = null;

function measureText(text: string, font: string): number {
    if (typeof document === "undefined") return text.length * 8;
    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    const context = measureCanvas.getContext("2d");
    if (!context) return text.length * 8;
    context.font = font;
    return context.measureText(text).width;
}

function middleEllipsize(text: string, availableWidth: number, font: string): string {
    if (!text || availableWidth <= 0) return text;
    if (measureText(text, font) <= availableWidth) return text;

    for (let visibleChars = text.length - 1; visibleChars >= 2; visibleChars -= 1) {
        const prefixChars = Math.ceil(visibleChars / 2);
        const suffixChars = Math.floor(visibleChars / 2);
        const candidate = `${text.slice(0, prefixChars)}${ELLIPSIS}${text.slice(-suffixChars)}`;
        if (measureText(candidate, font) <= availableWidth) return candidate;
    }

    const tail = text.slice(-Math.min(4, text.length));
    const tailCandidate = `${ELLIPSIS}${tail}`;
    return measureText(tailCandidate, font) <= availableWidth ? tailCandidate : ELLIPSIS;
}

export function MiddleEllipsizedAddress({
    address,
    className = "",
}: {
    address: string;
    className?: string;
}) {
    const text = address.trim();
    const textRef = useRef<HTMLSpanElement>(null);
    const [displayText, setDisplayText] = useState(text);

    const updateDisplayText = useCallback(() => {
        const element = textRef.current;
        if (!element) return;

        const styles = window.getComputedStyle(element);
        setDisplayText(middleEllipsize(text, element.clientWidth, styles.font));
    }, [text]);

    useLayoutEffect(() => {
        setDisplayText(text);
        const element = textRef.current;
        if (!element) return;

        updateDisplayText();

        const observer = new ResizeObserver(updateDisplayText);
        observer.observe(element);
        window.addEventListener("resize", updateDisplayText);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateDisplayText);
        };
    }, [text, updateDisplayText]);

    return (
        <span
            ref={textRef}
            className={`block min-w-0 max-w-full overflow-hidden whitespace-nowrap ${className}`}
            title={text}
        >
            {displayText}
        </span>
    );
}

export function CopyableAddress({
    address,
    displayText,
    wrap = false,
    className = "",
    textClassName = "",
    copyClassName = "",
    copyLabel = "Copy address",
    toastMessage = "Address copied",
}: {
    address: string;
    displayText?: string;
    wrap?: boolean;
    className?: string;
    textClassName?: string;
    copyClassName?: string;
    copyLabel?: string;
    toastMessage?: string;
}) {
    const text = address.trim();
    const [copied, setCopied] = useState(false);

    const copyAddress = useCallback(async () => {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success(toastMessage, { id: "clipboard-copy" });
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Could not copy address");
        }
    }, [text, toastMessage]);

    return (
        <span className={`inline-flex min-w-0 max-w-full items-start gap-1.5 ${className}`}>
            {wrap ? (
                <span
                    className={`min-w-0 flex-1 break-all font-mono leading-relaxed ${textClassName}`}
                    title={text}
                >
                    {displayText ?? text}
                </span>
            ) : displayText ? (
                <span
                    className={`block min-w-0 max-w-full overflow-hidden whitespace-nowrap font-mono ${textClassName}`}
                    title={text}
                >
                    {displayText}
                </span>
            ) : (
                <MiddleEllipsizedAddress address={text} className={`flex-1 font-mono ${textClassName}`} />
            )}
            <button
                type="button"
                onClick={copyAddress}
                disabled={!text}
                title={copyLabel}
                aria-label={copyLabel}
                className={`shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30 ${copyClassName}`}
            >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
        </span>
    );
}
