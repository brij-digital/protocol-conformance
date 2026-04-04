import BN from 'bn.js';
import {
  ClmmInstrument,
  LiquidityMath,
  SqrtPriceMath,
  getPdaPoolId,
  getPdaPoolVaultId,
} from '@raydium-io/raydium-sdk-v2';
import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { getTestWallet } from '../../src/support/runtime.js';
import {
  CLMM_SWAP_FIXTURE,
  RAYDIUM_CLMM_PROGRAM,
  RAYDIUM_CLMM_PROGRAM_ID,
  RAYDIUM_CLMM_PROTOCOL_ID,
} from './fixtures-clmm.js';
import { executeTransform, instructionPubkeys, lastInstruction, loadRuntimePack } from './helpers.js';

const runtimePack = loadRuntimePack('../../../protocol-registry/runtime/raydium-clmm.json');
const Q64 = 1n << 64n;

function toI32LeBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return bytes;
}

function floorDiv(left: bigint, right: bigint): bigint {
  return left / right;
}

function ceilDiv(left: bigint, right: bigint): bigint {
  return (left + right - 1n) / right;
}

function manualTokenAmountA(sqrtPriceA: BN, sqrtPriceB: BN, liquidity: BN, roundUp: boolean): string {
  let lower = BigInt(sqrtPriceA.toString());
  let upper = BigInt(sqrtPriceB.toString());
  if (lower > upper) {
    [lower, upper] = [upper, lower];
  }
  const numerator1 = BigInt(liquidity.toString()) << 64n;
  const numerator2 = upper - lower;
  if (roundUp) {
    const inner = ceilDiv(numerator1 * numerator2, upper);
    return ceilDiv(inner, lower).toString();
  }
  return floorDiv(floorDiv(numerator1 * numerator2, upper), lower).toString();
}

function manualTokenAmountB(sqrtPriceA: BN, sqrtPriceB: BN, liquidity: BN, roundUp: boolean): string {
  let lower = BigInt(sqrtPriceA.toString());
  let upper = BigInt(sqrtPriceB.toString());
  if (lower > upper) {
    [lower, upper] = [upper, lower];
  }
  const numerator = BigInt(liquidity.toString()) * (upper - lower);
  return (roundUp ? ceilDiv(numerator, Q64) : floorDiv(numerator, Q64)).toString();
}

describe('Raydium CLMM parity', () => {
  it('matches SDK instruction encoding and remaining accounts for swap_base_in', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_CLMM_PROTOCOL_ID,
      operationId: 'swap_base_in',
      input: {
        amm_config_id: CLMM_SWAP_FIXTURE.ammConfig.toBase58(),
        pool_id: CLMM_SWAP_FIXTURE.poolId.toBase58(),
        input_token_account: CLMM_SWAP_FIXTURE.userTokenA.toBase58(),
        output_token_account: CLMM_SWAP_FIXTURE.userTokenB.toBase58(),
        input_vault: CLMM_SWAP_FIXTURE.vaultA.toBase58(),
        output_vault: CLMM_SWAP_FIXTURE.vaultB.toBase58(),
        observation_id: CLMM_SWAP_FIXTURE.observationId.toBase58(),
        input_mint: CLMM_SWAP_FIXTURE.mintA.toBase58(),
        output_mint: CLMM_SWAP_FIXTURE.mintB.toBase58(),
        ex_bitmap: CLMM_SWAP_FIXTURE.exBitmap.toBase58(),
        tick_array0: CLMM_SWAP_FIXTURE.tickArrays[0].toBase58(),
        tick_array1: CLMM_SWAP_FIXTURE.tickArrays[1].toBase58(),
        tick_array2: CLMM_SWAP_FIXTURE.tickArrays[2].toBase58(),
        amount: CLMM_SWAP_FIXTURE.amountIn.toString(),
        other_amount_threshold: CLMM_SWAP_FIXTURE.amountOutMin.toString(),
        sqrt_price_limit_x64: CLMM_SWAP_FIXTURE.sqrtPriceLimitX64.toString(),
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: RAYDIUM_CLMM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const sdkInstruction = lastInstruction(
      ClmmInstrument.makeSwapBaseInInstructions({
        poolInfo: CLMM_SWAP_FIXTURE.poolInfo,
        poolKeys: CLMM_SWAP_FIXTURE.poolKeys as never,
        observationId: CLMM_SWAP_FIXTURE.observationId,
        ownerInfo: {
          wallet: CLMM_SWAP_FIXTURE.wallet,
          tokenAccountA: CLMM_SWAP_FIXTURE.userTokenA,
          tokenAccountB: CLMM_SWAP_FIXTURE.userTokenB,
        },
        inputMint: CLMM_SWAP_FIXTURE.mintA,
        amountIn: CLMM_SWAP_FIXTURE.amountIn,
        amountOutMin: CLMM_SWAP_FIXTURE.amountOutMin,
        sqrtPriceLimitX64: CLMM_SWAP_FIXTURE.sqrtPriceLimitX64,
        remainingAccounts: [...CLMM_SWAP_FIXTURE.tickArrays],
      }).instructions,
    );

    expect(runtimePreview.programId).toBe(sdkInstruction.programId.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(instructionPubkeys(sdkInstruction));
    expect(prepared.remainingAccounts).toEqual([]);
  });

  it('derives pool and vault PDAs consistently with the SDK helpers', async () => {
    const derived = await executeTransform({
      runtimePack,
      transformName: 'derive_pool_pdas',
      programId: RAYDIUM_CLMM_PROGRAM_ID,
      bindings: {
        amm_config_id: CLMM_SWAP_FIXTURE.ammConfig.toBase58(),
        mint_a: CLMM_SWAP_FIXTURE.mintA.toBase58(),
        mint_b: CLMM_SWAP_FIXTURE.mintB.toBase58(),
      },
    });

    expect(derived.pool_id).toBe(
      getPdaPoolId(
        RAYDIUM_CLMM_PROGRAM,
        CLMM_SWAP_FIXTURE.ammConfig,
        CLMM_SWAP_FIXTURE.mintA,
        CLMM_SWAP_FIXTURE.mintB,
      ).publicKey.toBase58(),
    );
    expect(derived.vault_a).toBe(
      getPdaPoolVaultId(
        RAYDIUM_CLMM_PROGRAM,
        CLMM_SWAP_FIXTURE.poolId,
        CLMM_SWAP_FIXTURE.mintA,
      ).publicKey.toBase58(),
    );
    expect(derived.vault_b).toBe(
      getPdaPoolVaultId(
        RAYDIUM_CLMM_PROGRAM,
        CLMM_SWAP_FIXTURE.poolId,
        CLMM_SWAP_FIXTURE.mintB,
      ).publicKey.toBase58(),
    );
    const expectedExBitmap = CLMM_SWAP_FIXTURE.exBitmap.toBase58();
    expect(derived.ex_bitmap).toBe(expectedExBitmap);
  });

  it('round-trips tick math across representative tick values', () => {
    const sampleTicks = [-443636, -120, 0, 1, 120, 443636];

    for (const tick of sampleTicks) {
      const sqrt = SqrtPriceMath.getSqrtPriceX64FromTick(tick);
      const derivedTick = SqrtPriceMath.getTickFromSqrtPriceX64(sqrt);

      expect(derivedTick).toBe(tick);
    }

    const zeroPrice = SqrtPriceMath.getSqrtPriceX64FromTick(0);
    expect(zeroPrice.toString()).toBe(new BN(Q64.toString()).toString());
  });

  it('matches liquidity token delta math against an independent bigint formula', () => {
    const liquidity = new BN('2000000000000');
    const sqrtPriceA = SqrtPriceMath.getSqrtPriceX64FromTick(-120);
    const sqrtPriceB = SqrtPriceMath.getSqrtPriceX64FromTick(120);

    expect(
      LiquidityMath.getTokenAmountAFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, false).toString(),
    ).toBe(manualTokenAmountA(sqrtPriceA, sqrtPriceB, liquidity, false));
    expect(
      LiquidityMath.getTokenAmountAFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, true).toString(),
    ).toBe(manualTokenAmountA(sqrtPriceA, sqrtPriceB, liquidity, true));
    expect(
      LiquidityMath.getTokenAmountBFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, false).toString(),
    ).toBe(manualTokenAmountB(sqrtPriceA, sqrtPriceB, liquidity, false));
    expect(
      LiquidityMath.getTokenAmountBFromLiquidity(sqrtPriceA, sqrtPriceB, liquidity, true).toString(),
    ).toBe(manualTokenAmountB(sqrtPriceA, sqrtPriceB, liquidity, true));

    const exBitmapSeed = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_tick_array_bitmap_extension'), CLMM_SWAP_FIXTURE.poolId.toBuffer()],
      RAYDIUM_CLMM_PROGRAM,
    )[0].toBase58();
    expect(exBitmapSeed).toBe(CLMM_SWAP_FIXTURE.exBitmap.toBase58());
    expect(toI32LeBytes(-120)).toEqual(new Uint8Array([136, 255, 255, 255]));
  });
});
