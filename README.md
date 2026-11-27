# Fairy Ring — Client-TS

**Browser client for RuneScape revision 377 (~2 May 2006).** It is a TypeScript port of Client-Java 377, the wire-format oracle.

| | |
|--|--|
| **Public beta** | [www.fairyring.rs](https://www.fairyring.rs/) |
| **Progress & gaps** | [Progress Chronicle](https://fairy-ring.github.io/) · [Open Accuracy Gaps](https://fairy-ring.github.io/gaps.html) |
| **Branch** | `rs2-r377` |
| **Upstream** | [LostCityRS/Client-TS](https://github.com/LostCityRS/Client-TS) |
| **Oracle** | Client-Java 377 |
| **Provenance** | [PROVENANCE.md](PROVENANCE.md) |
| **Notices** | [NOTICE.md](NOTICE.md) |
| **Contributing** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Agent brief** | [AGENTS.md](AGENTS.md) |

## Derived from Lost City — not Lost City

This repository is derived from Lost City / LostCityRS Client-TS work and keeps the upstream licenses and attribution described in [NOTICE.md](NOTICE.md).

This repository is **not** official Lost City or LostCityRS software, and it is **not** endorsed by Jagex Ltd. Do not present it as "Lost City Client" or as official LostCityRS work.

## AI-assisted development

We use AI tools and coding agents openly as part of development, alongside human review, compiled tests, and live verification. Humans own product judgment and ship every change. AI does not lower the authenticity bar.

## Purity

This is a pure play client: automation or test-injection hooks are kept out of this tree. Client behavior follows Client-Java 377.

## Companion repositories

| Repository | Role |
|------------|------|
| [FR-engine](https://github.com/Fairy-Ring/FR-engine) | Server, protocol, and pack tool. Serves this client from `public/client/`. |
| [FR-content](https://github.com/Fairy-Ring/FR-content) | Period game content: RuneScript, configs, maps, and assets. |
| [fairy-ring-workspace](https://github.com/Fairy-Ring/fairy-ring-workspace) | Project overview, documentation index, and public status. |
| [Fairy-Ring.github.io](https://github.com/Fairy-Ring/Fairy-Ring.github.io) | Public Progress Chronicle and open accuracy-gap tracker. |

## Getting started

You need [Bun](https://bun.sh). Clone this repository beside `engine` and `content`, then install dependencies. The repository has two submodules under `3rdparty/` (`bzip2-wasm` and `emsdk`):

```sh
git clone -b rs2-r377 https://github.com/Fairy-Ring/FR-client-ts.git client-ts
cd client-ts
git submodule update --init --recursive
bun install
```

## Build

```sh
bun run build      # writes out/client.js, out/mapview.js, out/ondemandworker.js, and their .map files
bun run build:dev  # development build
```

To play, copy `out/client.js`, `out/ondemandworker.js` (and their `.map` files), plus `node_modules/spessasynth_lib/dist/spessasynth_processor.min.js` into the engine's `public/client/` folder, start the engine as described in [FR-engine](https://github.com/Fairy-Ring/FR-engine), and open `rs2.html` on the engine's web port.

## Running checks

```sh
bun test
```

## Accuracy & completeness

We do **not** claim this tree is authentic, original, or complete. Work continues under an accuracy bar, and people and agents make mistakes.

- Read [AGENTS.md](AGENTS.md) for the working rules and the period-accuracy labels (`VERIFIED`, `CANDIDATE`, `UNKNOWN`, `DEVIATION`).
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution templates and review expectations.

## License & IP

- **Source authored here:** [MIT](LICENSE). See the `LICENSE` file for the full text.
- **Lost City–originated code:** keeps its upstream attribution. Do not relicense it as original work of this project. See [NOTICE.md](NOTICE.md).
- **Jagex material:** RuneScape is a trademark of Jagex Ltd. Jagex game assets, period client caches, and client builds made from them are not covered by MIT. See [NOTICE.md](NOTICE.md).
