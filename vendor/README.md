Vendored package artifacts used by deployment builds.

`govex-sdk-v3-0.2.1.tgz` is the packed SDK from Govex SDK commit
`5948d4174fecfca4f8a284270a954c527c1b016d`. The public frontend depends on this
file instead of the private GitHub SDK repository so `pnpm install --frozen-lockfile`
works in unauthenticated build containers.
