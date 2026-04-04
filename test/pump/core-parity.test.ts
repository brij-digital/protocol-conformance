import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import { getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk';
import { describe, expect, it } from 'vitest';
import { getTestWallet } from '../../src/support/runtime.js';
import {
  buildPumpCoreConnection,
  estimateBuyTokens,
  PUMP_CORE_FIXTURE,
  PUMP_CORE_PROGRAM_ID,
  PUMP_CORE_PROTOCOL_ID,
  PUMP_CORE_SDK,
} from './fixtures-core.js';
import { executeTransform, instructionPubkeys, loadRuntimePack } from './helpers.js';

const runtimePack = loadRuntimePack('../../../ec-ai-wallet/public/idl/pump_core.runtime.json');

describe('Pump Core parity', () => {
  it('matches SDK instruction encoding and remaining accounts for buy_exact_sol_in', async () => {
    const spendableSolIn = new BN('1000000000');
    const estimatedOut = estimateBuyTokens(spendableSolIn);
    const minTokensOut = estimatedOut.mul(new BN(9800)).div(new BN(10000));

    const prepared = await prepareRuntimeInstruction({
      protocolId: PUMP_CORE_PROTOCOL_ID,
      operationId: 'buy_exact_sol_in',
      input: {
        fee_recipient: PUMP_CORE_FIXTURE.feeRecipient.toBase58(),
        mint: PUMP_CORE_FIXTURE.baseMint.toBase58(),
        associated_user: PUMP_CORE_FIXTURE.associatedUser.toBase58(),
        creator_vault: PUMP_CORE_FIXTURE.creatorVault.toBase58(),
        max_sol_cost: spendableSolIn.toString(),
        amount: minTokensOut.toString(),
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: PUMP_CORE_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const sdkInstruction = await PUMP_CORE_SDK.getBuyInstructionRaw({
      user: PUMP_CORE_FIXTURE.wallet,
      mint: PUMP_CORE_FIXTURE.baseMint,
      creator: PUMP_CORE_FIXTURE.bondingCurveData.creator,
      feeRecipient: PUMP_CORE_FIXTURE.feeRecipient,
      amount: minTokensOut,
      solAmount: spendableSolIn,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    expect(prepared.accounts.global).toBe(PUMP_CORE_FIXTURE.globalPda.toBase58());
    expect(prepared.accounts.bonding_curve).toBe(PUMP_CORE_FIXTURE.bondingCurve.toBase58());
    expect(prepared.accounts.associated_bonding_curve).toBe(PUMP_CORE_FIXTURE.associatedBondingCurve.toBase58());
    expect(prepared.accounts.user).toBe(PUMP_CORE_FIXTURE.wallet.toBase58());
    expect(runtimePreview.programId).toBe(sdkInstruction.programId.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(instructionPubkeys(sdkInstruction).slice(0, runtimePreview.keys.length));
    expect(prepared.remainingAccounts.map((entry) => entry.pubkey)).toEqual(
      instructionPubkeys(sdkInstruction).slice(runtimePreview.keys.length),
    );
  });

  it('matches SDK quote math and PDA derivation for preview_buy_exact_sol_in', async () => {
    const spendableSolIn = new BN('1000000000');
    const expectedOut = getBuyTokenAmountFromSolAmount({
      global: PUMP_CORE_FIXTURE.global,
      feeConfig: null,
      mintSupply: new BN(PUMP_CORE_FIXTURE.mintRaw.supply.toString()),
      bondingCurve: PUMP_CORE_FIXTURE.bondingCurveData,
      amount: spendableSolIn,
    });

    const view = await runRuntimeView({
      protocolId: PUMP_CORE_PROTOCOL_ID,
      operationId: 'preview_buy_exact_sol_in',
      input: {
        base_mint: PUMP_CORE_FIXTURE.baseMint.toBase58(),
        spendable_sol_in: spendableSolIn.toString(),
        slippage_bps: 200,
        track_volume: false,
      },
      connection: (await buildPumpCoreConnection()) as never,
      walletPublicKey: getTestWallet(),
    });

    expect(view.derived.global).toBe(PUMP_CORE_FIXTURE.globalPda.toBase58());
    expect(view.derived.bonding_curve).toBe(PUMP_CORE_FIXTURE.bondingCurve.toBase58());
    expect(view.derived.associated_bonding_curve).toBe(PUMP_CORE_FIXTURE.associatedBondingCurve.toBase58());
    expect(view.derived.associated_user).toBe(PUMP_CORE_FIXTURE.associatedUser.toBase58());
    expect(view.derived.creator_vault).toBe(PUMP_CORE_FIXTURE.creatorVault.toBase58());
    expect(view.derived.estimated_out_auto).toBe(expectedOut.toString());
    expect(view.derived.min_tokens_out_auto).toBe(expectedOut.mul(new BN(9800)).div(new BN(10000)).toString());
  });

  it('computes preview_buy_exact_sol_in__transform consistently with the SDK quote path', async () => {
    const spendableSolIn = new BN('1000000000');
    const expectedOut = estimateBuyTokens(spendableSolIn);
    const derived = await executeTransform({
      runtimePack,
      transformName: 'preview_buy_exact_sol_in__transform',
      programId: PUMP_CORE_PROGRAM_ID,
      bindings: {
        input: {
          spendable_sol_in: spendableSolIn.toString(),
          slippage_bps: 200,
        },
        global_data: {
          fee_basis_points: PUMP_CORE_FIXTURE.global.feeBasisPoints.toString(),
          creator_fee_basis_points: PUMP_CORE_FIXTURE.global.creatorFeeBasisPoints.toString(),
        },
        bonding_curve_data: {
          creator: PUMP_CORE_FIXTURE.bondingCurveData.creator.toBase58(),
          virtual_token_reserves: PUMP_CORE_FIXTURE.bondingCurveData.virtualTokenReserves.toString(),
          virtual_sol_reserves: PUMP_CORE_FIXTURE.bondingCurveData.virtualSolReserves.toString(),
        },
      },
    });

    expect(derived.total_fee_bps).toBe('100');
    expect(derived.estimated_out_auto).toBe(expectedOut.toString());
    expect(derived.min_tokens_out_auto).toBe(expectedOut.mul(new BN(9800)).div(new BN(10000)).toString());
  });

  it('computes buy_exact_sol_in__transform consistently with the SDK quote path', async () => {
    const spendableSolIn = new BN('1000000000');
    const expectedOut = estimateBuyTokens(spendableSolIn);
    const derived = await executeTransform({
      runtimePack,
      transformName: 'buy_exact_sol_in__transform',
      programId: PUMP_CORE_PROGRAM_ID,
      bindings: {
        input: {
          spendable_sol_in: spendableSolIn.toString(),
          slippage_bps: 200,
        },
        global_data: {
          fee_basis_points: PUMP_CORE_FIXTURE.global.feeBasisPoints.toString(),
          creator_fee_basis_points: PUMP_CORE_FIXTURE.global.creatorFeeBasisPoints.toString(),
        },
        bonding_curve_data: {
          creator: PUMP_CORE_FIXTURE.bondingCurveData.creator.toBase58(),
          virtual_token_reserves: PUMP_CORE_FIXTURE.bondingCurveData.virtualTokenReserves.toString(),
          virtual_sol_reserves: PUMP_CORE_FIXTURE.bondingCurveData.virtualSolReserves.toString(),
        },
      },
    });

    expect(derived.creator_is_default).toBe(false);
    expect(derived.total_fee_bps).toBe('100');
    expect(derived.estimated_out_auto).toBe(expectedOut.toString());
  });
});
