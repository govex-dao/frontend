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

```bash
pnpm install
pnpm dev
```

No `.env` files are included in this public copy. Configure Vite variables
through your shell or hosting provider when needed:

```bash
VITE_NETWORK=mainnet VITE_BACKEND_URL=https://api.govex.ai pnpm build
```
