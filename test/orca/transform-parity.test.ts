import fs from 'node:fs';
import {
  tickIndexToSqrtPrice,
  tryApplySwapFee,
  tryGetAmountDeltaA,
  tryGetAmountDeltaB,
  tryGetNextSqrtPriceFromA,
  tryGetNextSqrtPriceFromB,
  tryReverseApplySwapFee,
  swapQuoteByInputToken,
  swapQuoteByOutputToken,
} from '@orca-so/whirlpools-core';
import { describe, expect, it } from 'vitest';
import { runRegisteredComputeStep, runRuntimeView } from '@brij-digital/apppack-runtime';
import { address } from '@solana/kit';
import { getTickArrayAddress, increaseLiquidityMethod } from '@orca-so/whirlpools-client';
import {
  buildCustomTickArrayArgs,
  buildWhirlpoolArgs,
  ORCA_PROGRAM_ID,
  ORCA_WHIRLPOOL,
  REWARD_MINTS,
  REWARD_VAULTS,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  toCoreTickArray,
  toCoreWhirlpool,
} from './fixtures.js';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

type JsonRecord = Record<string, unknown>;

type TransformStep = {
  name: string;
  kind: string;
  [key: string]: unknown;
};

type RuntimePack = {
  transforms: Record<string, TransformStep[]>;
};

const MIN_TICK_INDEX = -443636;
const MAX_TICK_INDEX = 443636;
const FEE_DENOMINATOR = 1_000_000n;

const runtimePack = JSON.parse(
  fs.readFileSync(new URL('../../../ec-ai-wallet/public/idl/orca_whirlpool.runtime.json', import.meta.url), 'utf8'),
) as RuntimePack;

const runtimeExecutorBase = {
  protocolId: 'orca_whirlpool',
  programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  connection: new StaticAccountConnection() as unknown,
  walletPublicKey: getTestWallet(),
  idl: {},
  previewInstruction: async () => ({
    programId: '',
    dataBase64: '',
    keys: [],
  }),
};

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must resolve to an object.`);
  }
  return value as JsonRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must resolve to an array.`);
  }
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must resolve to a string.`);
  }
  return value;
}

function normalizeRuntimeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeRuntimeValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nested]) => [key, normalizeRuntimeValue(nested)]),
    );
  }
  return value;
}

function resolvePath(scope: JsonRecord, path: string): unknown {
  const cleaned = path.startsWith('$') ? path.slice(1) : path;
  const parts = cleaned.split('.').filter(Boolean);
  let current: unknown = scope;
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      throw new Error(`Cannot resolve path ${path}.`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === undefined) {
    throw new Error(`Cannot resolve path ${path}.`);
  }
  return current;
}

function resolveTemplateValue(value: unknown, scope: JsonRecord): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    return resolvePath(scope, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, scope));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nested]) => [key, resolveTemplateValue(nested, scope)]),
    );
  }
  return value;
}

function resolveScopedOutput(output: unknown, scope: JsonRecord): unknown {
  return resolveTemplateValue(output, scope);
}

async function runNamedTransformStep(step: TransformStep, scope: JsonRecord): Promise<unknown> {
  const transformName = asString(step.transform, `compute:${step.name}:transform`);
  const transformSteps = runtimePack.transforms[transformName];
  if (!Array.isArray(transformSteps)) {
    throw new Error(`Transform ${transformName} not found in runtime pack.`);
  }
  const output = step.output;
  if (output === undefined) {
    throw new Error(`compute:${step.name}:output must be provided for transform step.`);
  }
  const bindingsRaw = step.bindings === undefined ? {} : asRecord(step.bindings, `compute:${step.name}:bindings`);
  const bindings = Object.fromEntries(
    Object.entries(bindingsRaw).map(([key, value]) => [key, normalizeRuntimeValue(resolveTemplateValue(value, scope))]),
  );
  const localScope: JsonRecord = {
    ...scope,
    ...bindings,
  };
  await runNestedTransformSteps(transformSteps, localScope);
  return normalizeRuntimeValue(resolveScopedOutput(output, localScope));
}

async function runComputeStep(step: TransformStep, scope: JsonRecord): Promise<unknown> {
  if (step.kind === 'transform') {
    return runNamedTransformStep(step, scope);
  }
  const resolvedStep = asRecord(normalizeRuntimeValue(resolveTemplateValue(step, scope)), `compute:${step.name}`);
  const kind = asString(resolvedStep.kind, `compute:${step.name}:kind`);
  return runRegisteredComputeStep(
    { ...resolvedStep, name: step.name, kind },
    {
      ...runtimeExecutorBase,
      scope,
    } as never,
  );
}

async function runNestedTransformSteps(steps: TransformStep[], scope: JsonRecord): Promise<void> {
  const derived: Record<string, unknown> = {};
  scope.derived = derived;
  for (const step of steps) {
    const value = await runComputeStep(step, scope);
    derived[step.name] = value;
    scope[step.name] = value;
    scope.derived = derived;
  }
}

async function executeTransform(
  transformName: string,
  bindings: Record<string, unknown>,
  outputPath: string,
): Promise<unknown> {
  const scope: JsonRecord = {
    runtime: runtimePack,
    ...bindings,
  };
  await runNestedTransformSteps(runtimePack.transforms[transformName], scope);
  return normalizeRuntimeValue(resolveScopedOutput(outputPath, scope));
}

function toComparable(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toComparable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, nested]) => [key, toComparable(nested)]));
  }
  return value;
}

function expectedSwapStepExactInput(args: {
  amountRemaining: bigint;
  feeRate: number;
  currLiquidity: bigint;
  currSqrtPrice: bigint;
  targetSqrtPrice: bigint;
  aToB: boolean;
}) {
  const amountLessFees = tryApplySwapFee(args.amountRemaining, args.feeRate);
  const fixedDeltaToTarget = args.aToB
    ? tryGetAmountDeltaA(args.currSqrtPrice, args.targetSqrtPrice, args.currLiquidity, true)
    : tryGetAmountDeltaB(args.currSqrtPrice, args.targetSqrtPrice, args.currLiquidity, true);
  const reachesTarget = fixedDeltaToTarget <= amountLessFees;
  const nextSqrtPrice = reachesTarget
    ? args.targetSqrtPrice
    : args.aToB
      ? tryGetNextSqrtPriceFromA(args.currSqrtPrice, args.currLiquidity, amountLessFees, true)
      : tryGetNextSqrtPriceFromB(args.currSqrtPrice, args.currLiquidity, amountLessFees, true);
  const amountIn = args.aToB
    ? tryGetAmountDeltaA(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, true)
    : tryGetAmountDeltaB(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, true);
  const amountOut = args.aToB
    ? tryGetAmountDeltaB(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, false)
    : tryGetAmountDeltaA(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, false);
  const feeAmount = reachesTarget
    ? tryReverseApplySwapFee(amountIn, args.feeRate) - amountIn
    : args.amountRemaining - amountIn;

  return {
    amount_in: amountIn,
    amount_out: amountOut,
    fee_amount: feeAmount,
    next_sqrt_price: nextSqrtPrice,
    reaches_target: reachesTarget,
    amount_less_fees: amountLessFees,
    fixed_delta_to_target: fixedDeltaToTarget,
    fee_rate_remaining: FEE_DENOMINATOR - BigInt(args.feeRate),
  };
}

function expectedSwapStepExactOutput(args: {
  amountRemaining: bigint;
  feeRate: number;
  currLiquidity: bigint;
  currSqrtPrice: bigint;
  targetSqrtPrice: bigint;
  aToB: boolean;
}) {
  const fixedDeltaToTarget = args.aToB
    ? tryGetAmountDeltaB(args.currSqrtPrice, args.targetSqrtPrice, args.currLiquidity, false)
    : tryGetAmountDeltaA(args.currSqrtPrice, args.targetSqrtPrice, args.currLiquidity, false);
  const reachesTarget = fixedDeltaToTarget <= args.amountRemaining;
  const partialNextSqrtPrice = args.aToB
    ? tryGetNextSqrtPriceFromB(args.currSqrtPrice, args.currLiquidity, args.amountRemaining, false)
    : tryGetNextSqrtPriceFromA(args.currSqrtPrice, args.currLiquidity, args.amountRemaining, false);
  const nextSqrtPrice = reachesTarget ? args.targetSqrtPrice : partialNextSqrtPrice;
  const amountOutRaw = args.aToB
    ? tryGetAmountDeltaB(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, false)
    : tryGetAmountDeltaA(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, false);
  const amountOut = amountOutRaw > args.amountRemaining ? args.amountRemaining : amountOutRaw;
  const amountIn = args.aToB
    ? tryGetAmountDeltaA(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, true)
    : tryGetAmountDeltaB(args.currSqrtPrice, nextSqrtPrice, args.currLiquidity, true);
  const feeAmount = tryReverseApplySwapFee(amountIn, args.feeRate) - amountIn;

  return {
    amount_in: amountIn,
    amount_out: amountOut,
    fee_amount: feeAmount,
    next_sqrt_price: nextSqrtPrice,
    reaches_target: reachesTarget,
    fixed_delta_to_target: fixedDeltaToTarget,
    fee_rate_remaining: FEE_DENOMINATOR - BigInt(args.feeRate),
  };
}

describe('Orca transform parity', () => {
  describe('quote_exact_in__tick_index_to_sqrt_price_x64', () => {
    const vectors = [
      { label: 'tick 0', tickIndex: 0 },
      { label: 'minimum tick', tickIndex: MIN_TICK_INDEX },
      { label: 'maximum tick', tickIndex: MAX_TICK_INDEX },
    ];

    it.each(vectors)('$label', async ({ tickIndex }) => {
      const actual = await executeTransform(
        'quote_exact_in__tick_index_to_sqrt_price_x64',
        { tick_index: tickIndex },
        '$tick_sqrt_price_x64',
      );

      expect(actual).toEqual(tickIndexToSqrtPrice(tickIndex).toString());
    });
  });

  describe('quote_exact_in__amount_delta_a', () => {
    const vectors = [
      {
        label: 'normal ascending range',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        targetSqrtPrice: tickIndexToSqrtPrice(100),
        currLiquidity: 1_000_000n,
        roundUp: false,
      },
      {
        label: 'rounding boundary with ceil',
        currSqrtPrice: tickIndexToSqrtPrice(MIN_TICK_INDEX),
        targetSqrtPrice: tickIndexToSqrtPrice(-1000),
        currLiquidity: 1n,
        roundUp: true,
      },
      {
        label: 'reversed range with zero liquidity',
        currSqrtPrice: tickIndexToSqrtPrice(100),
        targetSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 0n,
        roundUp: true,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_in__amount_delta_a', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        target_sqrt_price: vector.targetSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        round_up: vector.roundUp,
      }, '$value');

      expect(actual).toEqual(
        tryGetAmountDeltaA(vector.currSqrtPrice, vector.targetSqrtPrice, vector.currLiquidity, vector.roundUp).toString(),
      );
    });
  });

  describe('quote_exact_in__amount_delta_b', () => {
    const vectors = [
      {
        label: 'normal ascending range',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        targetSqrtPrice: tickIndexToSqrtPrice(100),
        currLiquidity: 1_000_000n,
        roundUp: false,
      },
      {
        label: 'rounding boundary with ceil',
        currSqrtPrice: tickIndexToSqrtPrice(MIN_TICK_INDEX),
        targetSqrtPrice: tickIndexToSqrtPrice(-1000),
        currLiquidity: 1n,
        roundUp: true,
      },
      {
        label: 'reversed range with zero liquidity',
        currSqrtPrice: tickIndexToSqrtPrice(100),
        targetSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 0n,
        roundUp: true,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_in__amount_delta_b', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        target_sqrt_price: vector.targetSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        round_up: vector.roundUp,
      }, '$value');

      expect(actual).toEqual(
        tryGetAmountDeltaB(vector.currSqrtPrice, vector.targetSqrtPrice, vector.currLiquidity, vector.roundUp).toString(),
      );
    });
  });

  describe('quote_exact_in__next_sqrt_price_from_a_round_up', () => {
    const vectors = [
      {
        label: 'zero amount returns current price',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 0n,
      },
      {
        label: 'normal exact-input move',
        currSqrtPrice: tickIndexToSqrtPrice(100),
        currLiquidity: 1_000_000n,
        amount: 999n,
      },
      {
        label: 'small-liquidity rounding case',
        currSqrtPrice: tickIndexToSqrtPrice(1),
        currLiquidity: 3n,
        amount: 1n,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_in__next_sqrt_price_from_a_round_up', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        amount: vector.amount.toString(),
      }, '$value');

      expect(actual).toEqual(
        tryGetNextSqrtPriceFromA(vector.currSqrtPrice, vector.currLiquidity, vector.amount, true).toString(),
      );
    });
  });

  describe('quote_exact_in__next_sqrt_price_from_b_round_down', () => {
    const vectors = [
      {
        label: 'zero amount returns current price',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 0n,
      },
      {
        label: 'normal exact-input move',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 999n,
      },
      {
        label: 'small-liquidity floor division case',
        currSqrtPrice: tickIndexToSqrtPrice(-1),
        currLiquidity: 3n,
        amount: 1n,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_in__next_sqrt_price_from_b_round_down', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        amount: vector.amount.toString(),
      }, '$value');

      expect(actual).toEqual(
        tryGetNextSqrtPriceFromB(vector.currSqrtPrice, vector.currLiquidity, vector.amount, true).toString(),
      );
    });
  });

  describe('quote_exact_out__next_sqrt_price_from_a_round_up', () => {
    const vectors = [
      {
        label: 'zero amount returns current price',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 0n,
      },
      {
        label: 'normal exact-output move',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 1_000n,
      },
      {
        label: 'small-liquidity rounding case',
        currSqrtPrice: tickIndexToSqrtPrice(1),
        currLiquidity: 5n,
        amount: 1n,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_out__next_sqrt_price_from_a_round_up', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        amount: vector.amount.toString(),
      }, '$value');

      expect(actual).toEqual(
        tryGetNextSqrtPriceFromA(vector.currSqrtPrice, vector.currLiquidity, vector.amount, false).toString(),
      );
    });
  });

  describe('quote_exact_out__next_sqrt_price_from_b_round_down', () => {
    const vectors = [
      {
        label: 'zero amount returns current price',
        currSqrtPrice: tickIndexToSqrtPrice(0),
        currLiquidity: 1_000_000n,
        amount: 0n,
      },
      {
        label: 'normal exact-output move',
        currSqrtPrice: tickIndexToSqrtPrice(100),
        currLiquidity: 1_000_000n,
        amount: 1_000n,
      },
      {
        label: 'small-liquidity rounding case',
        currSqrtPrice: tickIndexToSqrtPrice(-1),
        currLiquidity: 5n,
        amount: 1n,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_out__next_sqrt_price_from_b_round_down', {
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        amount: vector.amount.toString(),
      }, '$value');

      expect(actual).toEqual(
        tryGetNextSqrtPriceFromB(vector.currSqrtPrice, vector.currLiquidity, vector.amount, false).toString(),
      );
    });
  });

  describe('quote_exact_in__swap_step_exact_input', () => {
    const vectors = [
      {
        label: 'partial a-to-b step',
        amountRemaining: 1_000n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(100),
        targetSqrtPrice: tickIndexToSqrtPrice(0),
        aToB: true,
      },
      {
        label: 'target-reaching b-to-a step',
        amountRemaining: 100_000n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(0),
        targetSqrtPrice: tickIndexToSqrtPrice(100),
        aToB: false,
      },
      {
        label: 'zero amount input',
        amountRemaining: 0n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(0),
        targetSqrtPrice: tickIndexToSqrtPrice(10),
        aToB: false,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_in__swap_step_exact_input', {
        amount_remaining: vector.amountRemaining.toString(),
        fee_rate: vector.feeRate.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        target_sqrt_price: vector.targetSqrtPrice.toString(),
        a_to_b: vector.aToB,
      }, '$payload');

      expect(actual).toEqual(toComparable(expectedSwapStepExactInput(vector)));
    });
  });

  describe('quote_exact_out__swap_step_exact_output', () => {
    const vectors = [
      {
        label: 'partial a-to-b step',
        amountRemaining: 1_000n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(100),
        targetSqrtPrice: tickIndexToSqrtPrice(0),
        aToB: true,
      },
      {
        label: 'target-reaching b-to-a step',
        amountRemaining: 6_000n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(0),
        targetSqrtPrice: tickIndexToSqrtPrice(100),
        aToB: false,
      },
      {
        label: 'zero amount output',
        amountRemaining: 0n,
        feeRate: 300,
        currLiquidity: 1_000_000n,
        currSqrtPrice: tickIndexToSqrtPrice(100),
        targetSqrtPrice: tickIndexToSqrtPrice(0),
        aToB: true,
      },
    ];

    it.each(vectors)('$label', async (vector) => {
      const actual = await executeTransform('quote_exact_out__swap_step_exact_output', {
        amount_remaining: vector.amountRemaining.toString(),
        fee_rate: vector.feeRate.toString(),
        curr_liquidity: vector.currLiquidity.toString(),
        curr_sqrt_price: vector.currSqrtPrice.toString(),
        target_sqrt_price: vector.targetSqrtPrice.toString(),
        a_to_b: vector.aToB,
      }, '$payload');

      expect(actual).toEqual(toComparable(expectedSwapStepExactOutput(vector)));
    });
  });

  describe('quote_exact_in__derive_tick_arrays', () => {
    const vectors = [
      {
        label: 'a-to-b current array from token mint a',
        whirlpoolData: { token_mint_a: REWARD_MINTS[0], tick_spacing: 64, tick_current_index: 0 },
        input: { whirlpool: ORCA_WHIRLPOOL, token_in_mint: REWARD_MINTS[0] },
        expectedStarts: [0, -5632, -11264],
      },
      {
        label: 'b-to-a anchor shifts by tick spacing',
        whirlpoolData: { token_mint_a: REWARD_MINTS[0], tick_spacing: 64, tick_current_index: 5568 },
        input: { whirlpool: ORCA_WHIRLPOOL, token_in_mint: REWARD_MINTS[1] },
        expectedStarts: [5632, 11264, 16896],
      },
    ];

    it.each(vectors)('$label', async ({ whirlpoolData, input, expectedStarts }) => {
      const actual = await executeTransform(
        'quote_exact_in__derive_tick_arrays',
        {
          protocol: { programId: ORCA_PROGRAM_ID },
          whirlpool_data: whirlpoolData,
          input,
        },
        '$',
      );

      const expectedAddresses = await Promise.all(
        expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
      );

      const actualRecord = actual as JsonRecord;
      expect(actualRecord.tick_array_starts).toEqual(expectedStarts);
      expect(actualRecord.tick_arrays).toEqual(expectedAddresses);
    });
  });

  describe('quote_exact_out__derive_tick_arrays', () => {
    const vectors = [
      {
        label: 'a-to-b reuses current array start',
        whirlpoolData: { token_mint_a: REWARD_MINTS[0], token_mint_b: REWARD_MINTS[1], tick_spacing: 2, tick_current_index: 0 },
        input: { whirlpool: ORCA_WHIRLPOOL, token_in_mint: REWARD_MINTS[0], token_out_mint: REWARD_MINTS[1] },
        expectedStarts: [0, -176, -352],
      },
      {
        label: 'b-to-a positive traversal advances through three arrays',
        whirlpoolData: { token_mint_a: REWARD_MINTS[0], token_mint_b: REWARD_MINTS[2], tick_spacing: 3, tick_current_index: 792 },
        input: { whirlpool: ORCA_WHIRLPOOL, token_in_mint: REWARD_MINTS[2], token_out_mint: REWARD_MINTS[0] },
        expectedStarts: [792, 1056, 1320],
      },
    ];

    it.each(vectors)('$label', async ({ whirlpoolData, input, expectedStarts }) => {
      const actual = await executeTransform(
        'quote_exact_out__derive_tick_arrays',
        {
          protocol: { programId: ORCA_PROGRAM_ID },
          whirlpool_data: whirlpoolData,
          input,
        },
        '$',
      );

      const expectedAddresses = await Promise.all(
        expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
      );

      const actualRecord = actual as JsonRecord;
      expect(actualRecord.tick_array_starts).toEqual(expectedStarts);
      expect(actualRecord.tick_arrays).toEqual(expectedAddresses);
    });
  });

  describe('increase_liquidity_by_token_amounts_v2__normalize_method', () => {
    const vectors = [
      {
        label: 'small token maxima',
        method: {
          tokenMaxA: 10n,
          tokenMaxB: 12n,
          minSqrtPrice: 1n,
          maxSqrtPrice: 2n,
        },
      },
      {
        label: 'large bigint bounds',
        method: {
          tokenMaxA: 1234567890123456789n,
          tokenMaxB: 9876543210n,
          minSqrtPrice: 4295048016n,
          maxSqrtPrice: 79226673515401279992447579055n,
        },
      },
    ];

    it.each(vectors)('$label', async ({ method }) => {
      const actual = await executeTransform(
        'increase_liquidity_by_token_amounts_v2__normalize_method',
        {
          input: {
            method: toComparable(method),
          },
        },
        '$method_borsh',
      );

      expect(actual).toEqual({
        ByTokenAmounts: {
          tokenMaxA: method.tokenMaxA.toString(),
          tokenMaxB: method.tokenMaxB.toString(),
          minSqrtPrice: method.minSqrtPrice.toString(),
          maxSqrtPrice: method.maxSqrtPrice.toString(),
        },
      });
    });
  });

  describe('position_range__derive_tick_arrays', () => {
    const vectors = [
      {
        label: 'symmetric range on spacing 64',
        whirlpoolData: { tick_spacing: 64 },
        positionData: {
          whirlpool: ORCA_WHIRLPOOL,
          tick_lower_index: -5632,
          tick_upper_index: 5632,
        },
      },
      {
        label: 'asymmetric range on spacing 1',
        whirlpoolData: { tick_spacing: 1 },
        positionData: {
          whirlpool: ORCA_WHIRLPOOL,
          tick_lower_index: 37,
          tick_upper_index: 205,
        },
      },
    ];

    it.each(vectors)('$label', async ({ whirlpoolData, positionData }) => {
      const actual = await executeTransform(
        'position_range__derive_tick_arrays',
        {
          protocol: { programId: ORCA_PROGRAM_ID },
          whirlpool_data: whirlpoolData,
          position_data: positionData,
        },
        '$',
      );
      const ticksPerArray = whirlpoolData.tick_spacing * 88;
      const lowerStart = Math.floor(positionData.tick_lower_index / ticksPerArray) * ticksPerArray;
      const upperStart = Math.floor(positionData.tick_upper_index / ticksPerArray) * ticksPerArray;
      const [expectedLower] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), lowerStart);
      const [expectedUpper] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), upperStart);

      expect(actual).toEqual(
        expect.objectContaining({
          tick_array_lower: expectedLower,
          tick_array_upper: expectedUpper,
        }),
      );
    });
  });

  describe('collect_reward_v2__derive_reward_accounts', () => {
    const vectors = [
      { label: 'reward index 0', rewardIndex: 0 },
      { label: 'reward index 2', rewardIndex: 2 },
    ];

    it.each(vectors)('$label', async ({ rewardIndex }) => {
      const actual = await executeTransform(
        'collect_reward_v2__derive_reward_accounts',
        {
          input: { reward_index: rewardIndex },
          whirlpool_data: {
            reward_infos: REWARD_MINTS.map((mint, index) => ({
              mint,
              vault: REWARD_VAULTS[index],
            })),
          },
        },
        '$',
      );

      expect(actual).toEqual(
        expect.objectContaining({
          reward_mint: REWARD_MINTS[rewardIndex],
          reward_vault: REWARD_VAULTS[rewardIndex],
        }),
      );
    });
  });

  describe('quote_exact_in__quote_math', () => {
    const vectors = [
      {
        label: 'a-to-b sparse initialized ticks',
        whirlpoolArgs: buildWhirlpoolArgs({
          tickCurrentIndex: 120,
          tickSpacing: 4,
          sqrtPrice: tickIndexToSqrtPrice(120),
          feeRate: 1800,
          liquidity: 720000n,
        }),
        input: {
          whirlpool: ORCA_WHIRLPOOL,
          token_in_mint: TOKEN_MINT_A,
          token_out_mint: TOKEN_MINT_B,
          amount_in: '6800',
          slippage_bps: '220',
        },
        aToB: true,
        tickArrayArgs: [
          buildCustomTickArrayArgs(0, [
            { offset: 30, liquidityNet: 6000n, liquidityGross: 6000n },
            { offset: 28, liquidityNet: -2000n, liquidityGross: 2000n },
            { offset: 24, liquidityNet: 3500n, liquidityGross: 3500n },
          ]),
          buildCustomTickArrayArgs(-352, [
            { offset: 84, liquidityNet: 8000n, liquidityGross: 8000n },
            { offset: 70, liquidityNet: -1500n, liquidityGross: 1500n },
          ]),
          buildCustomTickArrayArgs(-704, []),
        ],
      },
      {
        label: 'b-to-a mixed liquidity changes',
        whirlpoolArgs: buildWhirlpoolArgs({
          tickCurrentIndex: 792,
          tickSpacing: 3,
          sqrtPrice: tickIndexToSqrtPrice(792),
          feeRate: 1000,
          liquidity: 950000n,
        }),
        input: {
          whirlpool: ORCA_WHIRLPOOL,
          token_in_mint: TOKEN_MINT_B,
          token_out_mint: TOKEN_MINT_A,
          amount_in: '7300',
          slippage_bps: '180',
        },
        aToB: false,
        tickArrayArgs: [
          buildCustomTickArrayArgs(792, [
            { offset: 1, liquidityNet: 3000n, liquidityGross: 3000n },
            { offset: 5, liquidityNet: -1500n, liquidityGross: 1500n },
            { offset: 20, liquidityNet: 7000n, liquidityGross: 7000n },
          ]),
          buildCustomTickArrayArgs(1056, [
            { offset: 0, liquidityNet: -2500n, liquidityGross: 2500n },
            { offset: 11, liquidityNet: 4500n, liquidityGross: 4500n },
          ]),
          buildCustomTickArrayArgs(1320, [{ offset: 8, liquidityNet: 9000n, liquidityGross: 9000n }]),
        ],
      },
    ];

    it.each(vectors)('$label', async ({ whirlpoolArgs, input, aToB, tickArrayArgs }) => {
      const connection = new StaticAccountConnection();
      connection.setWhirlpool(whirlpoolArgs);
      const tickArrayStarts = tickArrayArgs.map((tickArray) => tickArray.startTickIndex);
      const tickArrays = await Promise.all(
        tickArrayStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
      );
      tickArrays.forEach((tickArrayAddress, index) => {
        connection.setTickArray(tickArrayAddress, tickArrayArgs[index]);
      });
      const view = await runRuntimeView({
        protocolId: 'orca-whirlpool-mainnet',
        operationId: 'quote_exact_in',
        input: {
          ...input,
          unwrap_sol_output: false,
        },
        connection: connection as never,
        walletPublicKey: getTestWallet(),
      });
      const expected = swapQuoteByInputToken(
        BigInt(input.amount_in),
        aToB,
        Number(input.slippage_bps),
        toCoreWhirlpool(whirlpoolArgs),
        undefined,
        tickArrayArgs.map(toCoreTickArray),
        0n,
        undefined,
        undefined,
      );
      const output = view.output as JsonRecord;

      expect(view.derived.tick_array_starts).toEqual(tickArrayStarts);
      expect(view.derived.tick_arrays).toEqual(tickArrays);
      expect(output.estimated_out).toBe(expected.tokenEstOut.toString());
      expect(output.minimum_out).toBe(expected.tokenMinOut.toString());
      expect(output.pool_fee_bps).toBe(expected.tradeFeeRateMin);
    });
  });

  describe('quote_exact_out__quote_math', () => {
    const vectors = [
      {
        label: 'a-to-b exact output smoke-style window',
        whirlpoolArgs: buildWhirlpoolArgs({
          tickCurrentIndex: 0,
          tickSpacing: 2,
          sqrtPrice: 1n << 64n,
          feeRate: 3000,
          liquidity: 265000n,
        }),
        input: {
          whirlpool: ORCA_WHIRLPOOL,
          token_in_mint: TOKEN_MINT_A,
          token_out_mint: TOKEN_MINT_B,
          amount_out: '500',
          slippage_bps: '1000',
        },
        aToB: true,
        tickArrayArgs: [
          buildCustomTickArrayArgs(0, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: 1000n,
            liquidityGross: 1000n,
          }))),
          buildCustomTickArrayArgs(-176, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: -1000n,
            liquidityGross: 1000n,
          }))),
          buildCustomTickArrayArgs(-352, []),
        ],
      },
      {
        label: 'b-to-a exact output with widened positive traversal',
        whirlpoolArgs: buildWhirlpoolArgs({
          tickCurrentIndex: 0,
          tickSpacing: 2,
          sqrtPrice: 1n << 64n,
          feeRate: 3000,
          protocolFeeRate: 3000,
          liquidity: 265000n,
        }),
        input: {
          whirlpool: ORCA_WHIRLPOOL,
          token_in_mint: TOKEN_MINT_B,
          token_out_mint: TOKEN_MINT_A,
          amount_out: '500',
          slippage_bps: '1000',
        },
        aToB: false,
        tickArrayArgs: [
          buildCustomTickArrayArgs(0, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: -1000n,
            liquidityGross: 1000n,
          }))),
          buildCustomTickArrayArgs(176, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: -1000n,
            liquidityGross: 1000n,
          }))),
          buildCustomTickArrayArgs(352, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: -1000n,
            liquidityGross: 1000n,
          }))),
        ],
        coreReferenceTickArrayArgs: [
          buildCustomTickArrayArgs(-352, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: 1000n,
            liquidityGross: 1000n,
          }))),
          buildCustomTickArrayArgs(-176, Array.from({ length: 88 }, (_, offset) => ({
            offset,
            liquidityNet: 1000n,
            liquidityGross: 1000n,
          }))),
        ],
      },
    ];

    it.each(vectors)('$label', async ({ whirlpoolArgs, input, aToB, tickArrayArgs, coreReferenceTickArrayArgs }) => {
      const connection = new StaticAccountConnection();
      connection.setWhirlpool(whirlpoolArgs);
      const tickArrayStarts = tickArrayArgs.map((tickArray) => tickArray.startTickIndex);
      const tickArrays = await Promise.all(
        tickArrayStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
      );
      tickArrays.forEach((tickArrayAddress, index) => {
        connection.setTickArray(tickArrayAddress, tickArrayArgs[index]);
      });
      const view = await runRuntimeView({
        protocolId: 'orca-whirlpool-mainnet',
        operationId: 'quote_exact_out',
        input: {
          ...input,
          unwrap_sol_output: false,
        },
        connection: connection as never,
        walletPublicKey: getTestWallet(),
      });
      const expected = swapQuoteByOutputToken(
        BigInt(input.amount_out),
        aToB,
        Number(input.slippage_bps),
        toCoreWhirlpool(whirlpoolArgs),
        undefined,
        [...(coreReferenceTickArrayArgs ?? []), ...tickArrayArgs].map(toCoreTickArray),
        0n,
        undefined,
        undefined,
      );
      const output = view.output as JsonRecord;

      expect(view.derived.tick_array_starts).toEqual(tickArrayStarts);
      expect(view.derived.tick_arrays).toEqual(tickArrays);
      expect(output.amount_out).toBe(input.amount_out);
      expect(output.estimated_in).toBe(expected.tokenEstIn.toString());
      expect(output.maximum_in).toBe(expected.tokenMaxIn.toString());
      expect(output.pool_fee_bps).toBe(expected.tradeFeeRateMin);
    });
  });
});
