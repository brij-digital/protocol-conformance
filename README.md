# Orca Runtime Comparaison

Small conformance harness for comparing our current runtime implementation against real Orca Whirlpool behavior.

## Scope

This repo is intentionally narrow.

We compare the current runtime layer only:
- `views`
- `writes`
- `transforms`

We do **not** use:
- indexing specs
- action runner
- canonical DB flows

## Current focus

The first test wave targets:

1. `swap_exact_in`
   - low-level account derivation parity
   - low-level instruction encoding parity
2. `increase_liquidity_by_token_amounts_v2`
   - low-level derived-account parity from `position` state
   - low-level instruction encoding parity
3. `decrease_liquidity_v2`
   - low-level derived-account parity from `position` state
   - low-level instruction encoding parity
4. `collect_fees_v2`
   - low-level derived-account parity from `position` + `whirlpool` state
   - low-level instruction encoding parity
5. `collect_reward_v2`
   - reward-account selection parity from `reward_index`
   - low-level instruction encoding parity
6. `quote_exact_in`
   - tick-array derivation parity on simple and edge cases
   - exact-input quote parity on representative `A->B` and `B->A` fixtures

## Upstream reference

Reference protocol repo:
- [orca-so/whirlpools](https://github.com/orca-so/whirlpools)

Local clone used for source inspection:
- [`/Users/antoine/Documents/github/Espresso Cash/whirlpools`](/Users/antoine/Documents/github/Espresso%20Cash/whirlpools)
- current inspected upstream HEAD: `1fd68d049961d9731c2f8d92c1edec6538661803`

## Run

```bash
npm install
npm run check
npm test
```

## What success means today

- Green tests where the runtime matches Orca SDK behavior directly
- No fallback path hiding quote mismatches
- Enough coverage to tell whether the remaining gap is spec/runtime expressiveness or just missing implementation

## Current findings

The harness is now green on the first comparison wave:

- `swap_exact_in`
  - runtime resolves Orca-derived accounts correctly
  - runtime low-level instruction encoding matches Orca client
- `increase_liquidity_by_token_amounts_v2`
  - runtime derives whirlpool, token programs, owner ATAs, and position tick arrays from onchain `Position` + `Whirlpool` state
  - runtime low-level instruction encoding matches Orca client from the same `method` input shape the SDK uses
- `decrease_liquidity_v2`
  - runtime reuses the same position-backed derivation path and matches Orca on both accounts and instruction bytes
- `collect_fees_v2`
  - runtime derives the fee collection accounts from `Position` + `Whirlpool` state and matches Orca instruction encoding
- `collect_reward_v2`
  - runtime selects the correct reward mint/vault from `reward_index`, derives the owner ATA, and matches Orca instruction encoding
- `quote_exact_in`
  - runtime matches Orca tick-array derivation for the simple `A->B` case
  - runtime matches the `B->A` edge fixture where Orca core returns zero output
  - runtime matches a stronger `B->A` fixture with initialized ticks, including the `929 / 836` quote from Orca core
  - runtime matches the larger `B->A` exact-input case that previously overflowed in our simplified path
  - runtime now also matches a dense initialized `A->B` quote fixture across multiple arrays
  - runtime now matches a sparse `B->A` fixture with selected initialized ticks spread across arrays
  - runtime now also matches non-zero current-tick fixtures, including negative `A->B` and asymmetric `B->A` setups with custom spacing
  - runtime now also matches off-grid `sqrtPrice` fixtures and deeper multi-array crossings in both directions

That matters because the runtime is still doing this through:
- ordered load steps
- pure compute transforms
- no protocol-specific low-level CLMM primitive
- no fallback path

## Current read

What this repo shows now:

- the runtime model can already cover a meaningful Orca quote surface with generic compute building blocks
- the step pipeline and pure compute model are viable against a real protocol
- the next comparison wave should broaden coverage, not just re-argue the core shape of the runtime spec

The natural next candidates are:
- more quote fixtures with different fee tiers, current ticks, and price positions inside the tick range
- position update / fee-refresh style writes
- additional multi-step write paths
