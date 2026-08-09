# rs2-r377 — Client-TS

**Browser client** for **RuneScape revision 377** (~2 May 2006): a careful **1:1 port** of **Client-Java 377** to TypeScript.

| | |
|--|--|
| **Public name** | **rs2-r377** (client-ts tree) |
| **Branch** | `rs2-r377` |
| **Upstream lineage** | [LostCityRS/Client-TS](https://github.com/LostCityRS/Client-TS) **`289`** @ `bc4751da0748704307eef9e186015b08834fccf7` · Java oracle [Client-Java](https://github.com/LostCityRS/Client-Java) |
| **Provenance** | [PROVENANCE.md](PROVENANCE.md) — full SHA pin + history note |
| **Companion workspace** | [rs2-r377 workspace](https://github.com/acfrazier/LC-rs2-r377-workspace) |

## Derived from Lost City — not Lost City

This repository is a **derivation** of open **Lost City / LostCityRS Client-TS** work (itself a human-driven port of period client code). We build on those trees under their licenses, with our own residual fixes and purity rules.

**Derivation does not mean official.** This is **not** affiliated with, endorsed by, or representative of Lost City / LostCityRS, rs2b2t / N64Jive (unless they adopt material), or Jagex Ltd.

Do **not** present this repo as “Lost City Client,” “LC,” or official LostCityRS.  
See [NOTICE.md](NOTICE.md).

## AI use (explicit)

Development of this fork **uses AI tools and coding agents**. Humans own product judgment. **Bot / harness hooks must not be installed in this tree** — see workspace Decision 004 (client vs harness boundary). Toys live in `tools/harness/` of the workspace only.

## Product purity (hard fence)

| This repo | Not this repo |
|-----------|----------------|
| Pure play client behaviour (Java 377 → TS) | Harness injectors, prep cheats, thrash loops |
| Residual client bugs that block authentic play | Soft-pass “green bars” for smokes |
| Browser build for `rs2.html` / engine `public/` | Full bot framework (later: separate adapter path) |

Client-TS **289** (or other branches) is **not** behavioural truth for 377 work.

## Launch-together

Intended to go **public with** content, engine, and workspace under the **rs2-r377** brand (GitHub names may still use legacy `LC-rs2-*` until rename at flip). Visibility flips only on operator call.

| Companion | Role |
|-----------|------|
| **Engine** | Serves protocol + packs content |
| **Content** | Period scripts/configs |
| **Workspace** | Docs, harness, residual proofs |

## Build / run (high level)

Exact steps depend on Engine-TS / workspace pack pipeline. Typical flow:

1. Build client bundle for the engine’s `public/client/` (or workspace `bun tools/harness/build-client.mjs` for **harness** builds — those are **toys**, not purity claims).  
2. Pure play: open engine’s client page (`rs2.html` or equivalent).  
3. Match **revision 377** engine + content branches.

See workspace runbooks for isolation ports and headed harness policy.

## License

This project is licensed under the [MIT License](LICENSE) as upstream.  
Do **not** relicense Lost City–originated code as original work of this project.  
See [NOTICE.md](NOTICE.md).

## Upstream

- Client-TS: https://github.com/LostCityRS/Client-TS  
- Client-Java: https://github.com/LostCityRS/Client-Java  
- Lost City forum: https://lostcity.rs/

**Never push experiment work to `LostCityRS/*` without explicit permission.**  
Private backup remote (operator): `private` → `acfrazier/LC-rs2-r377-client-ts` (rename target: `rs2-r377-client-ts` at public flip).
