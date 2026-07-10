import { lazy, Suspense, useState } from "react";
import { Wallet } from "lucide-react";

import { Button } from "@/components/inputs/Button";

const LazyWalletButton = lazy(() =>
    import("./WalletButton").then(({ SuiWalletButton }) => ({ default: SuiWalletButton }))
);
const LazyWalletIsland = lazy(() => import("./WalletIsland").then(({ WalletIsland }) => ({ default: WalletIsland })));

interface WalletControlProps {
    buttonClassName?: string;
    suiProviderAvailable: boolean;
}

function WalletLoadingButton({ buttonClassName }: { buttonClassName?: string }) {
    return (
        <Button variant="secondary" className={buttonClassName} leftIcon={<Wallet className="w-4 h-4" />} isLoading>
            Loading wallet
        </Button>
    );
}

export function WalletControl({ buttonClassName, suiProviderAvailable }: WalletControlProps) {
    const [activated, setActivated] = useState(false);
    const fallback = <WalletLoadingButton buttonClassName={buttonClassName} />;

    if (suiProviderAvailable) {
        return (
            <Suspense fallback={fallback}>
                <LazyWalletButton buttonClassName={buttonClassName} />
            </Suspense>
        );
    }

    if (activated) {
        return (
            <Suspense fallback={fallback}>
                <LazyWalletIsland buttonClassName={buttonClassName} initiallyOpen />
            </Suspense>
        );
    }

    return (
        <Button
            variant="secondary"
            className={buttonClassName}
            leftIcon={<Wallet className="w-4 h-4" />}
            onClick={() => setActivated(true)}
        >
            Connect Wallet
        </Button>
    );
}
