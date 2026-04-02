import { PublicKey } from '@solana/web3.js';
import {
  getPositionEncoder,
  getTickArrayEncoder,
  getWhirlpoolEncoder,
  type PositionArgs,
  type TickArrayArgs,
  type TickArgs,
  type WhirlpoolArgs,
} from '@orca-so/whirlpools-client';
import { address } from '@solana/kit';

export const ORCA_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
export const ORCA_WHIRLPOOL = '2kJmUjxWBwL2NGPBV2PiA5hWtmLCqcKY6reQgkrPtaeS';
export const ORCA_CONFIG = '2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ';
export const TOKEN_MINT_A = 'So11111111111111111111111111111111111111112';
export const TOKEN_MINT_B = '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const POSITION_MINT = 'HqoV7Qv27REUtmd9UKSJGGmCRNx3531t33bDG1BUfo9K';
export const TEST_WALLET = '11111111111111111111111111111111';

const FIXED_REWARD_MINTS = [
  '11111111111111111111111111111112',
  '11111111111111111111111111111114',
  '11111111111111111111111111111116',
];

const FIXED_REWARD_VAULTS = [
  '11111111111111111111111111111113',
  '11111111111111111111111111111115',
  '11111111111111111111111111111117',
];

export function buildWhirlpoolArgs(options?: {
  tickCurrentIndex?: number;
  tickSpacing?: number;
  sqrtPrice?: bigint;
  feeRate?: number;
  protocolFeeRate?: number;
  liquidity?: bigint;
}): WhirlpoolArgs {
  const tickSpacing = options?.tickSpacing ?? 64;
  return {
    whirlpoolsConfig: address(ORCA_CONFIG),
    whirlpoolBump: new Uint8Array([255]),
    tickSpacing,
    feeTierIndexSeed: new Uint8Array([tickSpacing, 0]),
    feeRate: options?.feeRate ?? 300,
    protocolFeeRate: options?.protocolFeeRate ?? 1800,
    liquidity: options?.liquidity ?? 32523523532n,
    sqrtPrice: options?.sqrtPrice ?? 32523523532n,
    tickCurrentIndex: options?.tickCurrentIndex ?? 0,
    protocolFeeOwedA: 0n,
    protocolFeeOwedB: 0n,
    tokenMintA: address(TOKEN_MINT_A),
    tokenVaultA: address(PublicKey.default.toBase58()),
    feeGrowthGlobalA: 0n,
    tokenMintB: address(TOKEN_MINT_B),
    tokenVaultB: address(PublicKey.default.toBase58()),
    feeGrowthGlobalB: 0n,
    rewardLastUpdatedTimestamp: 0n,
    rewardInfos: FIXED_REWARD_MINTS.map((mint, index) => ({
      mint: address(mint),
      vault: address(FIXED_REWARD_VAULTS[index]),
      extension: new Uint8Array(32),
      emissionsPerSecondX64: 0n,
      growthGlobalX64: 0n,
    })),
  };
}

export function encodeWhirlpoolAccount(args: WhirlpoolArgs): Buffer {
  return Buffer.from(getWhirlpoolEncoder().encode(args));
}

export function buildPositionArgs(options?: {
  whirlpool?: string;
  positionMint?: string;
  liquidity?: bigint;
  tickLowerIndex?: number;
  tickUpperIndex?: number;
}): PositionArgs {
  return {
    whirlpool: address(options?.whirlpool ?? ORCA_WHIRLPOOL),
    positionMint: address(options?.positionMint ?? POSITION_MINT),
    liquidity: options?.liquidity ?? 0n,
    tickLowerIndex: options?.tickLowerIndex ?? -5632,
    tickUpperIndex: options?.tickUpperIndex ?? 5632,
    feeGrowthCheckpointA: 0n,
    feeOwedA: 0n,
    feeGrowthCheckpointB: 0n,
    feeOwedB: 0n,
    rewardInfos: Array.from({ length: 3 }, () => ({
      growthInsideCheckpoint: 0n,
      amountOwed: 0n,
    })),
  };
}

export function encodePositionAccount(args: PositionArgs): Buffer {
  return Buffer.from(getPositionEncoder().encode(args));
}

export function buildBlankTick(options?: {
  initialized?: boolean;
  liquidityNet?: bigint;
  liquidityGross?: bigint;
  feeGrowthOutsideA?: bigint;
  feeGrowthOutsideB?: bigint;
  rewardGrowthsOutside?: [bigint, bigint, bigint];
}): TickArgs {
  return {
    initialized: options?.initialized ?? false,
    liquidityNet: options?.liquidityNet ?? 0n,
    liquidityGross: options?.liquidityGross ?? 0n,
    feeGrowthOutsideA: options?.feeGrowthOutsideA ?? 0n,
    feeGrowthOutsideB: options?.feeGrowthOutsideB ?? 0n,
    rewardGrowthsOutside: options?.rewardGrowthsOutside ?? [0n, 0n, 0n],
  };
}

export function buildTickArrayArgs(
  startTickIndex: number,
  options?: {
    initialized?: boolean;
    positiveLiquidity?: boolean;
  },
): TickArrayArgs {
  const initialized = options?.initialized ?? false;
  const positiveLiquidity = options?.positiveLiquidity ?? true;
  const liquidityNet = positiveLiquidity ? 1000n : -1000n;
  return {
    startTickIndex,
    whirlpool: address(ORCA_WHIRLPOOL),
    ticks: Array.from({ length: 88 }, () =>
      buildBlankTick(
        initialized
          ? {
              initialized: true,
              liquidityNet,
              liquidityGross: 1000n,
              feeGrowthOutsideA: 0n,
              feeGrowthOutsideB: 0n,
              rewardGrowthsOutside: [0n, 0n, 0n],
            }
          : undefined,
      ),
    ),
  };
}

export type TickOverride = {
  offset: number;
  initialized?: boolean;
  liquidityNet?: bigint;
  liquidityGross?: bigint;
  feeGrowthOutsideA?: bigint;
  feeGrowthOutsideB?: bigint;
  rewardGrowthsOutside?: [bigint, bigint, bigint];
};

export function buildCustomTickArrayArgs(
  startTickIndex: number,
  overrides: TickOverride[],
): TickArrayArgs {
  const ticks = Array.from({ length: 88 }, () => buildBlankTick());
  for (const override of overrides) {
    if (override.offset < 0 || override.offset >= ticks.length) {
      throw new Error(`Tick override offset ${override.offset} is out of range for TickArray.`);
    }
    ticks[override.offset] = buildBlankTick({
      initialized: override.initialized ?? true,
      liquidityNet: override.liquidityNet ?? 0n,
      liquidityGross: override.liquidityGross ?? 0n,
      feeGrowthOutsideA: override.feeGrowthOutsideA ?? 0n,
      feeGrowthOutsideB: override.feeGrowthOutsideB ?? 0n,
      rewardGrowthsOutside: override.rewardGrowthsOutside ?? [0n, 0n, 0n],
    });
  }
  return {
    startTickIndex,
    whirlpool: address(ORCA_WHIRLPOOL),
    ticks,
  };
}

export function encodeTickArrayAccount(args: TickArrayArgs): Buffer {
  return Buffer.from(getTickArrayEncoder().encode(args));
}

export function toCoreTickArray(args: TickArrayArgs) {
  return {
    startTickIndex: args.startTickIndex,
    ticks: args.ticks.map((tick) => ({
      initialized: tick.initialized,
      liquidityNet: BigInt(tick.liquidityNet),
      liquidityGross: BigInt(tick.liquidityGross),
      feeGrowthOutsideA: BigInt(tick.feeGrowthOutsideA),
      feeGrowthOutsideB: BigInt(tick.feeGrowthOutsideB),
      rewardGrowthsOutside: tick.rewardGrowthsOutside.map((value) => BigInt(value)),
    })),
  };
}

export function toCoreWhirlpool(args: WhirlpoolArgs) {
  return {
    feeTierIndexSeed: args.feeTierIndexSeed,
    tickSpacing: args.tickSpacing,
    feeRate: args.feeRate,
    protocolFeeRate: args.protocolFeeRate,
    liquidity: BigInt(args.liquidity),
    sqrtPrice: BigInt(args.sqrtPrice),
    tickCurrentIndex: args.tickCurrentIndex,
    feeGrowthGlobalA: BigInt(args.feeGrowthGlobalA),
    feeGrowthGlobalB: BigInt(args.feeGrowthGlobalB),
    rewardLastUpdatedTimestamp: BigInt(args.rewardLastUpdatedTimestamp),
    rewardInfos: args.rewardInfos.map((reward) => ({
      emissionsPerSecondX64: BigInt(reward.emissionsPerSecondX64),
      growthGlobalX64: BigInt(reward.growthGlobalX64),
    })),
  };
}

export function expectedTickArrayStarts(options: {
  tickCurrentIndex: number;
  tickSpacing?: number;
  aToB: boolean;
}): [number, number, number] {
  const tickSpacing = options.tickSpacing ?? 64;
  const ticksPerArray = tickSpacing * 88;
  if (options.aToB) {
    const currentStart = Math.floor(options.tickCurrentIndex / ticksPerArray) * ticksPerArray;
    return [currentStart, currentStart - ticksPerArray, currentStart - 2 * ticksPerArray];
  }

  const shifted = options.tickCurrentIndex + tickSpacing;
  const currentStart = Math.floor(shifted / ticksPerArray) * ticksPerArray;
  return [currentStart, currentStart + ticksPerArray, currentStart + 2 * ticksPerArray];
}

export const SWAP_EXACT_IN_INPUT = {
  amount: '1000',
  other_amount_threshold: '900',
  sqrt_price_limit: '4295048016',
  amount_specified_is_input: true,
  a_to_b: true,
  token_program_a: TOKEN_PROGRAM,
  token_program_b: TOKEN_PROGRAM,
  whirlpool: ORCA_WHIRLPOOL,
  token_mint_a: TOKEN_MINT_A,
  token_mint_b: TOKEN_MINT_B,
  token_vault_a: PublicKey.default.toBase58(),
  token_vault_b: PublicKey.default.toBase58(),
  tick_array0: '8PhPzk7n4wU98Z6XCbVtPai2LtXSxYnfjkmgWuoAU8Zy',
  tick_array1: 'GvqHLwv8B74NafR6UZYfzTnXY1FzMsnp9r1Weoq3DEud',
  tick_array2: 'EfySJCs1Ky84xHBj4DgFmXv3XRLVwirPCD3YzQG8CbDQ',
} as const;
