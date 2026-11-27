# Contributing to Fairy Ring — Client-TS

Thank you for helping improve **Fairy Ring** (`FR-client-ts`, a pure 1:1 TypeScript port of **Client-Java 377**, ~2 May 2006).

Fairy Ring is an independent open-source project derived from Lost City / LostCityRS (`NOTICE.md`). It is **not** official Lost City and is **not** endorsed by Jagex Ltd. Never push or open pull requests against `LostCityRS/*`.

## Who can contribute

Everyone — humans and coding agents acting in good faith. Changes are judged on **Client-Java 377 parity, purity, and falsifiable tests**.

If you are pointing a coding agent at this repository, have it read **[`AGENTS.md`](AGENTS.md)** first.

## Hard purity boundary

This repository is a **pure play client only**. Bot adapters, automation hooks, and test-harness injectors do not belong here and will be rejected.

## Maintainer review policy (honest expectations)

- **Issues** citing an exact behavioral divergence from **Client-Java 377** (`file:line`) are always welcome.
- **Pull requests** are welcome as concrete proposals. Review and merge are **best-effort**; small parity PRs with a `bun test` regression that fails before and passes after are fastest to review.

## Which repository?

| Change | Repository |
|---|---|
| Pure Java 377 → TypeScript browser client parity (packets, UI, rendering, audio, input) | **This repo (`FR-client-ts`)** |
| Server protocol, cycle, compiler, packer | [FR-engine](https://github.com/Fairy-Ring/FR-engine) |
| Quests, NPCs, items, RuneScript gameplay, maps/configs | [FR-content](https://github.com/Fairy-Ring/FR-content) |
| Process docs, research methodology, scoped context requests | [fairy-ring-workspace](https://github.com/Fairy-Ring/fairy-ring-workspace) |

## Quick local verification

```sh
bun install
bun test
```

## License

Licensed under [MIT](LICENSE) (as upstream Lost City). Do not commit cache blobs, `.env`, keys, or local machine paths.
