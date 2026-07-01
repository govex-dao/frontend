Vendored package artifacts used by deployment builds.

`govex-futarchy-sdk-0.2.1-e9c7224.tgz` is the packed SDK from Govex SDK commit
`e9c7224530e30847b5f908e3f1e054475e52d815`. The public frontend depends on this
file instead of the private GitHub SDK repository so `pnpm install --frozen-lockfile`
works in unauthenticated build containers.
