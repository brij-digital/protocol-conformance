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
2. `quote_exact_in`
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
- `quote_exact_in`
  - runtime matches Orca tick-array derivation for the simple `A->B` case
  - runtime matches the `B->A` edge fixture where Orca core returns zero output
  - runtime matches a stronger `B->A` fixture with initialized ticks, including the `929 / 836` quote from Orca core
  - runtime matches the larger `B->A` exact-input case that previously overflowed in our simplified path
  - runtime now also matches a dense initialized `A->B` quote fixture across multiple arrays
  - runtime now matches a sparse `B->A` fixture with selected initialized ticks spread across arrays

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
- more quote fixtures with different fee tiers and current ticks
- liquidity-management flows
- additional multi-step write paths
