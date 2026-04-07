import BN from 'bn.js';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { executeTransform, loadRuntimePack } from './helpers.js';

const require = createRequire(import.meta.url);
const DLMM = require('@meteora-ag/dlmm') as typeof import('@meteora-ag/dlmm');
const {
  DEFAULT_BIN_PER_POSITION,
  IDL,
  MAX_BIN_ARRAY_SIZE,
  POSITION_BIN_DATA_SIZE,
  POSITION_MIN_SIZE,
  PositionV2Wrapper,
  RebalancePosition,
  StrategyType,
  autoFillXByStrategy,
  binIdToBinArrayIndex,
  calculatePositionSize,
  calculateSpotDistribution,
  deriveBinArrayBitmapExtension,
  deriveEventAuthority,
  deriveLbPair,
  deriveOracle,
  derivePosition,
  deriveReserve,
} = DLMM;
const METEORA_DLMM_PROGRAM_ID = new PublicKey(IDL.address);
const runtimePackPath = new URL('../../../protocol-registry/runtime/meteora-dlmm.json', import.meta.url);
const fallbackRuntimePack = {
  transforms: {
    derive_position_related_pdas: [
      {
        name: 'position',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [
          { kind: 'utf8', value: 'position' },
          { kind: 'pubkey', value: '$lb_pair' },
          { kind: 'pubkey', value: '$base' },
          { kind: 'i32_le', value: '$lower_bin_id' },
          { kind: 'i32_le', value: '$width' },
        ],
      },
      {
        name: 'reserve_x',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [
          { kind: 'pubkey', value: '$lb_pair' },
          { kind: 'pubkey', value: '$token_x' },
        ],
      },
      {
        name: 'reserve_y',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [
          { kind: 'pubkey', value: '$lb_pair' },
          { kind: 'pubkey', value: '$token_y' },
        ],
      },
      {
        name: 'oracle',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [
          { kind: 'utf8', value: 'oracle' },
          { kind: 'pubkey', value: '$lb_pair' },
        ],
      },
      {
        name: 'bitmap',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [
          { kind: 'utf8', value: 'bitmap' },
          { kind: 'pubkey', value: '$lb_pair' },
        ],
      },
      {
        name: 'event_authority',
        kind: 'pda(seed_spec)',
        program_id: METEORA_DLMM_PROGRAM_ID.toBase58(),
        seeds: [{ kind: 'utf8', value: '__event_authority' }],
      },
    ],
  },
};
const runtimePack = fs.existsSync(runtimePackPath)
  ? loadRuntimePack('../../../protocol-registry/runtime/meteora-dlmm.json')
  : fallbackRuntimePack;

function manualBinArrayIndex(binId: number): string {
  const size = MAX_BIN_ARRAY_SIZE.toNumber();
  return Math.floor(binId / size).toString();
}

function manualSpotDistribution(activeBin: number, binIds: number[]) {
  if (!binIds.includes(activeBin)) {
    const dist = Math.floor(10000 / binIds.length);
    const rem = 10000 % binIds.length;
    const loss = rem === 0 ? 0 : 1;
    if (binIds[0] < activeBin) {
      return binIds.map((binId, index) => ({
        binId,
        xAmountBpsOfTotal: '0',
        yAmountBpsOfTotal: String(index === 0 ? dist + loss : dist),
      }));
    }
    return binIds.map((binId, index) => ({
      binId,
      xAmountBpsOfTotal: String(index === binIds.length - 1 ? dist + loss : dist),
      yAmountBpsOfTotal: '0',
    }));
  }

  const binYCount = binIds.filter((binId) => binId < activeBin).length;
  const binXCount = binIds.filter((binId) => binId > activeBin).length;
  const yBinBps = Math.floor(10000 / (binYCount + 0.5));
  const xBinBps = Math.floor(10000 / (binXCount + 0.5));
  const yActiveBinBps = 10000 - yBinBps * binYCount;
  const xActiveBinBps = 10000 - xBinBps * binXCount;

  return binIds.map((binId) => {
    if (binId < activeBin) {
      return { binId, xAmountBpsOfTotal: '0', yAmountBpsOfTotal: String(yBinBps) };
    }
    if (binId > activeBin) {
      return { binId, xAmountBpsOfTotal: String(xBinBps), yAmountBpsOfTotal: '0' };
    }
    return {
      binId,
      xAmountBpsOfTotal: String(xActiveBinBps),
      yAmountBpsOfTotal: String(yActiveBinBps),
    };
  });
}

function sortableMints(tokenA: PublicKey, tokenB: PublicKey): [PublicKey, PublicKey] {
  return tokenA.toBuffer().compare(tokenB.toBuffer()) === 1 ? [tokenB, tokenA] : [tokenA, tokenB];
}

function manualLbPairPda(tokenA: PublicKey, tokenB: PublicKey, binStep: BN): PublicKey {
  const [minKey, maxKey] = sortableMints(tokenA, tokenB);
  return PublicKey.findProgramAddressSync(
    [
      minKey.toBuffer(),
      maxKey.toBuffer(),
      Uint8Array.from(binStep.toArrayLike(Buffer, 'le', 2)),
    ],
    METEORA_DLMM_PROGRAM_ID,
  )[0];
}

function manualPositionPda(lbPair: PublicKey, base: PublicKey, lowerBinId: BN, width: BN): PublicKey {
  const lowerBinIdBytes = lowerBinId.isNeg()
    ? Uint8Array.from(lowerBinId.toTwos(32).toArrayLike(Buffer, 'le', 4))
    : Uint8Array.from(lowerBinId.toArrayLike(Buffer, 'le', 4));
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('position'),
      lbPair.toBuffer(),
      base.toBuffer(),
      lowerBinIdBytes,
      Uint8Array.from(width.toArrayLike(Buffer, 'le', 4)),
    ],
    METEORA_DLMM_PROGRAM_ID,
  )[0];
}

describe('Meteora DLMM parity', () => {
  it('matches SDK bin array index math across negative and positive bin ids', () => {
    const sampleBinIds = [-141, -70, -69, -1, 0, 1, 69, 70, 141];

    for (const binId of sampleBinIds) {
      expect(binIdToBinArrayIndex(new BN(binId)).toString()).toBe(manualBinArrayIndex(binId));
    }
  });

  it('matches position sizing and wrapper coverage calculations for synthetic positions', () => {
    const lbPair = new PublicKey('8opHzTAnfzRpPEx21XtnrVTX28YQuCpAjcn1PczScKh');
    const owner = new PublicKey('2q7pyhPw8QF4Hq1mRk2nrXL6N3iNf2A7Fp8ZUBKbjrKM');
    const nonExtended = new PositionV2Wrapper(
      new PublicKey('DxB4DZ6sVaqk9WavTHgb6xGtuuQB3Lt1PPYUajF2iGaD'),
      {
        lbPair,
        owner,
        lowerBinId: -35,
        upperBinId: 34,
        feeOwner: owner,
        lockReleasePoint: new BN(0),
        operator: owner,
        totalClaimedFeeXAmount: new BN(0),
        totalClaimedFeeYAmount: new BN(0),
        totalClaimedRewards: [new BN(0), new BN(0)],
        lastUpdatedAt: new BN(0),
      } as never,
      [],
      { liquidityShares: [], rewardInfos: [], feeInfos: [] },
    );
    const extended = new PositionV2Wrapper(
      new PublicKey('Guct4sXJ5tQcs93iXjDxVkxvb8448kgo1e89vrQzbWWS'),
      {
        lbPair,
        owner,
        lowerBinId: -140,
        upperBinId: 140,
        feeOwner: owner,
        lockReleasePoint: new BN(0),
        operator: owner,
        totalClaimedFeeXAmount: new BN(0),
        totalClaimedFeeYAmount: new BN(0),
        totalClaimedRewards: [new BN(0), new BN(0)],
        lastUpdatedAt: new BN(0),
      } as never,
      [{} as never],
      { liquidityShares: [], rewardInfos: [], feeInfos: [] },
    );
    const binCount = new BN(150);
    const manualSize = new BN(POSITION_MIN_SIZE).add(
      binCount.sub(DEFAULT_BIN_PER_POSITION).mul(new BN(POSITION_BIN_DATA_SIZE)),
    );

    expect(nonExtended.width().toString()).toBe('70');
    expect(nonExtended.getBinArrayIndexesCoverage().map((index) => index.toString())).toEqual(['-1', '0']);
    expect(extended.getBinArrayIndexesCoverage().map((index) => index.toString())).toEqual(['-2', '-1', '0', '1', '2']);
    expect(calculatePositionSize(binCount).toString()).toBe(manualSize.toString());
  });

  it('matches rebalance aggregation helpers for synthetic bin liquidity data', () => {
    const rebalancePosition = new RebalancePosition(
      new PublicKey('BkV4wMofqbv7hDdBrYqKqRR3YKHyCuXapnwMaijvSEez'),
      {
        lowerBinId: -10,
        upperBinId: 10,
        owner: new PublicKey('2q7pyhPw8QF4Hq1mRk2nrXL6N3iNf2A7Fp8ZUBKbjrKM'),
        positionBinData: [],
      } as never,
      {} as never,
      null,
      true,
      true,
      new BN(0),
    );

    rebalancePosition.rebalancePositionBinData = [
      {
        binId: -1,
        price: '1',
        pricePerToken: '1',
        amountX: new BN(10),
        amountY: new BN(20),
        claimableRewardAmount: [new BN(3), new BN(4)],
        claimableFeeXAmount: new BN(5),
        claimableFeeYAmount: new BN(6),
      },
      {
        binId: 0,
        price: '1',
        pricePerToken: '1',
        amountX: new BN(30),
        amountY: new BN(40),
        claimableRewardAmount: [new BN(7), new BN(8)],
        claimableFeeXAmount: new BN(9),
        claimableFeeYAmount: new BN(10),
      },
    ];

    expect(rebalancePosition.totalAmounts().map((value) => value.toString())).toEqual(['40', '60']);
    expect(rebalancePosition.totalFeeAmounts().map((value) => value.toString())).toEqual(['14', '16']);
    expect(rebalancePosition.totalRewardAmounts().map((value) => value.toString())).toEqual(['10', '12']);
  });

  it('matches SDK spot distribution and strategy autofill outputs', () => {
    const activeBin = 100;
    const binIds = [98, 99, 100, 101, 102];
    const amountY = new BN('1000000');
    const amountXInActiveBin = new BN('5000');
    const amountYInActiveBin = new BN('7000');
    const normalizedDistribution = calculateSpotDistribution(activeBin, binIds).map((entry) => ({
      binId: entry.binId,
      xAmountBpsOfTotal: entry.xAmountBpsOfTotal.toString(),
      yAmountBpsOfTotal: entry.yAmountBpsOfTotal.toString(),
    }));

    expect(normalizedDistribution).toEqual(manualSpotDistribution(activeBin, binIds));
    expect(
      autoFillXByStrategy(
        activeBin,
        25,
        amountY,
        amountXInActiveBin,
        amountYInActiveBin,
        98,
        102,
        StrategyType.Spot,
      ).toString(),
    ).toBe('763337');
  });

  it('matches SDK PDA derivations and the Meteora runtime pack for pool and position addresses', async () => {
    const tokenA = new PublicKey('So11111111111111111111111111111111111111112');
    const tokenB = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const base = new PublicKey('6h8cQN4kYxhM9f2wV9zp1KimG1Hj6kUMnUxr87hcPLZ9');
    const binStep = new BN(25);
    const lowerBinId = new BN(-140);
    const width = new BN(281);
    const sdkLbPair = deriveLbPair(tokenA, tokenB, binStep, METEORA_DLMM_PROGRAM_ID)[0];
    const derived = await executeTransform({
      runtimePack,
      transformName: 'derive_position_related_pdas',
      programId: METEORA_DLMM_PROGRAM_ID.toBase58(),
      bindings: {
        lb_pair: sdkLbPair.toBase58(),
        base: base.toBase58(),
        lower_bin_id: lowerBinId.toString(),
        width: width.toString(),
        token_x: tokenA.toBase58(),
        token_y: tokenB.toBase58(),
      },
    });

    expect(sdkLbPair.toBase58()).toBe(manualLbPairPda(tokenA, tokenB, binStep).toBase58());
    expect(derivePosition(sdkLbPair, base, lowerBinId, width, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(
      manualPositionPda(sdkLbPair, base, lowerBinId, width).toBase58(),
    );
    expect(deriveReserve(tokenA, sdkLbPair, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(derived.reserve_x);
    expect(deriveReserve(tokenB, sdkLbPair, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(derived.reserve_y);
    expect(derivePosition(sdkLbPair, base, lowerBinId, width, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(
      derived.position,
    );
    expect(deriveOracle(sdkLbPair, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(derived.oracle);
    expect(deriveBinArrayBitmapExtension(sdkLbPair, METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(derived.bitmap);
    expect(deriveEventAuthority(METEORA_DLMM_PROGRAM_ID)[0].toBase58()).toBe(derived.event_authority);
  });
});
