# Protocol Conformance

Multi-protocol conformance harness for AppPack.

This repo verifies instruction encoding, account derivation, quote math, and transform parity against official protocol SDKs. It runs entirely offline using the local `protocol-runtime` package plus canonical artifacts from the sibling `protocol-registry` checkout.

## Current Coverage

| Protocol | SDK | Tests | Coverage |
|---|---|---|---|
| **Orca Whirlpool** | `@orca-so/whirlpools-core` + `@orca-so/whirlpools-client` | 93 | Swap, two-hop, LP (open/close/increase/decrease), collect fees/rewards, all transforms, edge cases, integration |
| **Pump AMM** | `@pump-fun/pump-swap-sdk` | 8 | Buy/sell encoding, quote parity, transform parity, PDA derivation |
| **Pump Core** | `@pump-fun/pump-sdk` | 5 | Buy encoding, bonding curve quotes, transform parity |
| **Kamino K-Lend** | `@kamino-finance/klend-sdk` | 17 | Deposit/borrow/repay/withdraw encoding, PDA derivation, obligation decoding, offline quote flows |
| **Marinade** | `@marinade.finance/marinade-ts-sdk` | 6 | Deposit, unstake, action preparation, runtime view parity |
| **Meteora DLMM** | `@meteora-ag/dlmm` | 8 | Action preparation, transform parity, offline execution wiring |
| **Sanctum Router** | `@sanctumso/sanctum-router` | 10 | Action preparation and conformance checks |
| **Raydium CLMM** | `@raydium-io/raydium-sdk-v2` | 4 | Swap encoding, remaining accounts, tick math, pool PDAs |

Current full-suite snapshot: `19` files, `151` tests.

## Workspace Layout

This repo expects sibling checkouts for:

- `../protocol-runtime`
- `../protocol-registry`

Typical local layout:

```text
AppPACK/
  protocol-conformance/
  protocol-runtime/
  protocol-registry/
```

## Structure

```text
src/
  support/runtime.ts          # Shared: StaticAccountConnection + canonical registry path
test/
  orca/                       # Orca Whirlpool tests
    runtime-parity.test.ts    #   Write encoding + view quote parity
    transform-parity.test.ts  #   Individual transform math parity
    edge-cases.test.ts        #   Edge cases (tickSpacing=1, large amounts, etc.)
    integration.test.ts       #   Quote -> swap pipeline integration
    lp-operations.test.ts     #   Open/close position, LP quotes
    two-hop.test.ts           #   Two-hop swap encoding + quotes
  pump/                       # Pump AMM + Core tests
  kamino/                     # Kamino K-Lend tests
  marinade/                   # Marinade tests
  meteora/                    # Meteora DLMM tests
  raydium/                    # Raydium CLMM tests
  sanctum/                    # Sanctum tests
```

## What We Test

1. **Instruction encoding** — runtime-built instruction matches the official SDK byte-for-byte.
2. **Account derivation** — PDAs, ATAs, oracles, and other derived accounts match SDK helpers.
3. **Transform parity** — runtime math such as quotes, tick math, and swap steps matches SDK behavior exactly.

## Run

Install dependencies and run the full suite:

```bash
npm install
npx vitest run
```

Run only the Orca conformance suite:

```bash
npx vitest run test/orca
```

Run one focused Orca file:

```bash
npx vitest run test/orca/runtime-parity.test.ts
```

Typecheck the harness:

```bash
npm run check
```

## How It Works

All tests run offline. `StaticAccountConnection` mocks Solana account reads with fixture data, then the harness compares AppPack runtime output against official SDK output.

Runtime and Codama artifacts are resolved directly from the canonical sibling `protocol-registry` checkout via `src/support/runtime.ts`.

For the Orca path specifically, the main entrypoints are:

- `test/orca/runtime-parity.test.ts`
- `test/orca/transform-parity.test.ts`
- `test/orca/integration.test.ts`

## Related Repos

- [`protocol-registry`](https://github.com/brij-digital/protocol-registry) — protocol specs and canonical artifacts
- [`protocol-runtime`](https://github.com/brij-digital/protocol-runtime) — execution engine used by the harness
- [`protocol-indexing`](https://github.com/brij-digital/protocol-indexing) — index service
- [`protocol-ui`](https://github.com/brij-digital/protocol-ui) — wallet app
