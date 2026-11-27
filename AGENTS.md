# Agent & Contributor Rules — Fairy Ring Client-TS (Revision 377)

Fairy Ring preserves RuneScape 2 **revision 377** (about **2 May 2006**). This repository (`FR-client-ts`) is a pure **1:1 port of Client-Java 377 to TypeScript**, derived from Lost City / LostCityRS `Client-TS` (`NOTICE.md`). Never present Fairy Ring as official Lost City, and never push or open PRs against `LostCityRS/*`.

Both humans and coding agents are welcome to contribute under the same parity and purity bar.

## 1. Hard rules (non-negotiable)

1. **Behavioral oracle is Client-Java 377.**
   - Every packet layout (`p1isaac` callsites in `Client.java`, primitives in `Packet.java`), entity resolution, menu action, rendering quirk, and varp array behavior must match **Client-Java 377**.
   - **Client-TS 289 is NOT behavioral truth for revision 377.** Engine descriptors are cross-checks, not the authority for client field order or transforms.
2. **Product purity fence (zero bot/harness hooks).**
   - **Never** add bot hooks, debug backdoors, Playwright injectors, test-only globals, or automation bridges to this repository. Keep this tree a pure play client.
3. **No speculative QoL or modern client changes.**
   - Deviations from Java 377 are treated as conformance defects unless explicitly approved by maintainers.

## 2. Local verification loop

```sh
bun install
bun test
```

Every parity fix must include a regression test (e.g. in `Client377Parity.test.ts` or a focused `*.test.ts`) that **fails before the fix and passes after**, citing the exact `Client-Java` 377 `file:line`.

## 3. Hygiene

- Keep changes minimal and scoped to one parity defect per PR.
- Never commit cache blobs, local machine or home-directory paths, secrets, or build dumps.
