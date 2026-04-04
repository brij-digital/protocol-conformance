# Protocol Conformance

Multi-protocol conformance harness for AppPack. Tests instruction encoding, account derivation, quote math, and transform parity against official protocol SDKs.

## Protocols

| Protocol | SDK | Tests | Coverage |
|---|---|---|---|
| **Orca Whirlpool** | `@orca-so/whirlpools-core` + `@orca-so/whirlpools-client` | 80 | Swap, two-hop, LP (open/close/increase/decrease), collect fees/rewards, all transforms, edge cases, integration |
| **Pump AMM** | `@pump-fun/pump-swap-sdk` | 18 | Buy/sell encoding, quote parity, transform parity, PDA derivation |
| **Pump Core** | `@pump-fun/pump-sdk` | 7 | Buy encoding, bonding curve quotes, transform parity |
| **Kamino K-Lend** | `@kamino-finance/klend-sdk` | 6 | Deposit/borrow/repay/withdraw encoding, PDA derivation, obligation decoding |
| **Raydium** | `@raydium-io/raydium-sdk-v2` | _in progress_ | CLMM + AMM v4 swap, tick math, pool PDAs |

## Structure

```
src/
  support/runtime.ts          # Shared: StaticAccountConnection, registry path
test/
  orca/                       # Orca Whirlpool tests
    runtime-parity.test.ts    #   Write encoding + view quote parity
    transform-parity.test.ts  #   Individual transform math parity
    edge-cases.test.ts        #   Edge cases (tickSpacing=1, large amounts, etc.)
    integration.test.ts       #   Quote → swap pipeline integration
    lp-operations.test.ts     #   Open/close position, LP quotes
    two-hop.test.ts           #   Two-hop swap encoding + quotes
    fixtures.ts               #   Pool, position, tick array fixtures
    helpers.ts                #   Transform executor, test utils
  pump/                       # Pump AMM + Core tests
    amm-parity.test.ts        #   Buy/sell encoding + quotes vs SDK
    core-parity.test.ts       #   Bonding curve buy encoding + quotes
    fixtures-amm.ts           #   Pool, global config, fee config fixtures
    fixtures-core.ts          #   Bonding curve, global fixtures
    helpers.ts                #   Transform executor, instruction helpers
  kamino/                     # Kamino K-Lend tests
    lending-parity.test.ts    #   Deposit/borrow/repay/withdraw encoding + PDAs
    fixtures.ts               #   Reserve, obligation, lending market fixtures
  raydium/                    # Raydium tests (in progress)
    clmm-parity.test.ts       #   CLMM swap + tick math
    amm-parity.test.ts        #   AMM v4 swap
    fixtures-clmm.ts          #   CLMM pool fixtures
    fixtures-amm.ts           #   AMM pool fixtures
```

## What We Test

1. **Instruction encoding** — runtime-built instruction matches official SDK byte-for-byte
2. **Account derivation** — PDAs, ATAs, oracles match SDK helpers
3. **Transform parity** — runtime math (quotes, tick math, swap steps) matches SDK exactly

## Run

```bash
npm install
npx vitest run
```

## How It Works

All tests run **offline** — no Solana RPC needed. We use `StaticAccountConnection` to mock account reads with fixture data, then compare our runtime spec output against the official SDK output.

## Related Repos

- [`protocol-registry`](https://github.com/brij-digital/protocol-registry) — protocol specs (source of truth)
- [`protocol-runtime`](https://github.com/brij-digital/protocol-runtime) — execution engine
- [`protocol-indexing`](https://github.com/brij-digital/protocol-indexing) — index service
- [`protocol-ui`](https://github.com/brij-digital/protocol-ui) — wallet app
