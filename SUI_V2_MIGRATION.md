# Sui V2 Frontend Migration

## Summary

The frontend no longer constructs a JSON-RPC dApp Kit client. It now builds the
app SDK and dApp Kit client with a Sui gRPC transport, and uses GraphQL for the
legacy event-query paths that need indexed filtering.

Sui JSON-RPC public endpoint shutdown timing from Sui docs:

- Testnet: week of July 6, 2026
- Mainnet: week of July 20, 2026

Official docs:

- https://docs.sui.io/develop/accessing-data/json-rpc-migration
- https://sdk.mystenlabs.com/sui/migrations/sui-2.0/json-rpc-migration
- https://sdk.mystenlabs.com/sui/migrations/sui-2.0/dapp-kit
- https://sdk.mystenlabs.com/sui/clients/grpc

## Railway Variables

Frontend service:

```bash
VITE_NETWORK=mainnet
VITE_BACKEND_URL=https://backend-api-v2-mainnet.up.railway.app
VITE_SUI_GRPC_URL=https://fullnode.mainnet.sui.io:443
VITE_SUI_GRAPHQL_URL=https://graphql.mainnet.sui.io/graphql
```

`VITE_SUI_RPC_URL` is no longer used by the frontend and should be removed after
deploying this version.

Do not put provider API keys or bearer tokens in any `VITE_*` variable. Use
browser-safe dedicated gRPC/GraphQL endpoints for production. The public Sui
URLs above are acceptable as a temporary fallback, not as the preferred
production capacity plan.

Backend services still keep their own server-side `SUI_RPC_URL` where they use
JSON-RPC code paths. The gRPC indexer should keep `SUI_GRPC_URL` and
`SUI_GRPC_TOKEN` or the equivalent provider-specific derivation variables on
the backend service only.

## Deployment Order

1. Commit and push SDK changes.
2. Commit and push the updated frontend vendored SDK tarball and frontend
   transport wiring.
3. Update frontend Railway variables.
4. Redeploy the frontend.
5. Redeploy backend services only if their code or backend-only variables have
   changed. The gRPC checkpoint indexer migration does not require a database
   reset.
