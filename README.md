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
   - tick-array derivation parity on a simple case
   - an explicit boundary probe for a B->A edge case

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

- Green tests where the current runtime already matches Orca
- Explicit tests that show where the current runtime still breaks or diverges

That is the point of this repo: turn runtime/spec discussion into concrete parity evidence.

## Current findings

The initial harness already shows both parity and a real boundary:

- `swap_exact_in`:
  - runtime resolves Orca-derived accounts correctly
  - runtime low-level instruction encoding matches Orca client
- `quote_exact_in`:
  - runtime matches Orca tick-array derivation for a simple A->B case
  - runtime now also matches the expected B->A tick-array derivation on the current edge fixture
  - runtime can now execute `quote_exact_in` as an ordered step pipeline:
    - decode whirlpool
    - derive tick-array PDAs
    - decode those derived tick-array accounts
    - then run quote math
  - but the current B->A quote math still diverges from Orca core on that edge fixture
  - for larger B->A inputs on that fixture, the current runtime quote path overflows before instruction preview, while Orca core still returns a valid quote

That is exactly the signal we want:
- green where the runtime is already faithful
- a precise boundary where account derivation is correct but quote semantics are still off
- no fallback path hiding the failure

## Current boundary read

What the harness suggests right now:

- the current runtime model is already good enough for:
  - deterministic account derivation
  - instruction assembly
  - simple quote flows
- the current gap is narrower than that:
  - on the current Orca `B->A` edge fixture, we can derive the correct tick-array PDAs
  - but the current quote transform still uses simplified math that diverges from Orca core
  - for larger inputs on that same fixture, that simplified path overflows before instruction preview

So the current red zone is not "runtime cannot do Orca".
It is more specifically:

- the current spec/runtime combination does not yet reproduce Orca's exact quote semantics on harder swap paths
- and the harness now isolates that boundary without adding any fallback path
