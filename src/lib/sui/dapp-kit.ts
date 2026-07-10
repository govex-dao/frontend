import { createDAppKit } from "@mysten/dapp-kit-core";
import { createGrpcCompatClient } from "@govex/futarchy-sdk/config";
import { getGraphqlUrlForNetwork, getGrpcUrlForNetwork, network, type NetworkName } from "@/lib/config";

const networks: NetworkName[] = ["mainnet", "testnet", "devnet", "localnet"];

export const dAppKit = createDAppKit({
    networks,
    defaultNetwork: network,
    createClient: (networkName: NetworkName) =>
        createGrpcCompatClient({
            network: networkName,
            grpcUrl: getGrpcUrlForNetwork(networkName),
            graphqlUrl: getGraphqlUrlForNetwork(networkName),
        }),
});

declare module "@mysten/dapp-kit-core" {
    interface Register {
        dAppKit: typeof dAppKit;
    }
}
