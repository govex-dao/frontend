# Frontend

## License And Brand

The frontend source code is licensed under the MIT License.

The MIT License does not grant trademark rights. The Govex name, logos,
icons, domain names, and related brand identifiers are reserved by Govex DAO
LLC. If you publicly host, distribute, or sell a fork or modified version of
this frontend, remove or replace Govex brand assets and do not imply that your
deployment is the official Govex app unless you have written permission.

See [TRADEMARKS.md](./TRADEMARKS.md).

## How to Run

This frontend consumes the public SDK directly from
[`govex-dao/sdk-v3`](https://github.com/govex-dao/sdk-v3).

```bash
pnpm install
pnpm dev
```

No `.env` files are included in this public copy. Configure Vite variables
through your shell or hosting provider when needed:

```bash
VITE_NETWORK=mainnet \
VITE_BACKEND_URL=https://backend-api-v2-mainnet.up.railway.app \
VITE_SUI_GRPC_URL=https://fullnode.mainnet.sui.io:443 \
VITE_SUI_GRAPHQL_URL=https://graphql.mainnet.sui.io/graphql \
pnpm build
```

## Railway

This repository includes `railway.toml` for a standalone Railway frontend
service. The Railway build installs dependencies, builds the app, and serves
`dist/` with the checked-in `serve.json` security headers.

Recommended production variables:

```bash
VITE_NETWORK=mainnet
VITE_BACKEND_URL=https://backend-api-v2-mainnet.up.railway.app
VITE_SUI_GRPC_URL=https://fullnode.mainnet.sui.io:443
VITE_SUI_GRAPHQL_URL=https://graphql.mainnet.sui.io/graphql
```

Do not put secrets in `VITE_*` variables. For production, replace the public
Sui endpoints above with browser-safe dedicated endpoints that do not expose a
provider token.

See [SUI_V2_MIGRATION.md](./SUI_V2_MIGRATION.md) for the transport and
deployment notes.
