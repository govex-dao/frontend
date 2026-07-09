import { createDAppKit } from "@mysten/dapp-kit-core";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getRpcUrlForNetwork, network, type NetworkName } from "@/lib/config";

const networks: NetworkName[] = ["mainnet", "testnet", "devnet", "localnet"];

export const dAppKit = createDAppKit({
    networks,
    defaultNetwork: network,
    createClient: (networkName: NetworkName) =>
        new SuiJsonRpcClient({
            network: networkName,
            url: getRpcUrlForNetwork(networkName),
        }),
});

declare module "@mysten/dapp-kit-core" {
    interface Register {
        dAppKit: typeof dAppKit;
    }
}
