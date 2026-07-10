import { DAppKitProvider } from "@mysten/dapp-kit-react";

import { dAppKit } from "@/lib/sui/dapp-kit";
import { SuiWalletButton } from "./WalletButton";

interface WalletIslandProps {
    buttonClassName?: string;
    initiallyOpen?: boolean;
}

export function WalletIsland({ buttonClassName, initiallyOpen = false }: WalletIslandProps) {
    return (
        <DAppKitProvider dAppKit={dAppKit}>
            <SuiWalletButton buttonClassName={buttonClassName} initiallyOpen={initiallyOpen} />
        </DAppKitProvider>
    );
}
