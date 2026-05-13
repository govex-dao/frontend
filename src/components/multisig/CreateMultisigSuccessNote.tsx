import { useNavigate } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/inputs/Button";

interface Props {
    accountId: string;
    onClose: () => void;
}

export function CreateMultisigSuccessNote({ accountId, onClose }: Props) {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-[22rem] items-center justify-center">
            <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="rounded-lg border border-border-subtle bg-card-more-elevated/50 px-6 py-7 shadow-lg shadow-black/20">
                    <p className="font-serif text-lg italic leading-relaxed text-text-primary">
                        Thanks for trusting Govex to help secure your assets.
                    </p>
                    <p className="mt-4 text-sm leading-6 text-text-muted">
                        Reach out to Gresham on Telegram at{" "}
                        <a
                            href="https://t.me/ggccggccc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary transition-colors hover:text-primary-light"
                        >
                            @ggccggccc
                        </a>{" "}
                        if you need any support.
                    </p>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    {accountId && (
                        <Button
                            onClick={() => {
                                onClose();
                                navigate(`/multisig/${accountId}`);
                            }}
                        >
                            View multisig
                        </Button>
                    )}
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
