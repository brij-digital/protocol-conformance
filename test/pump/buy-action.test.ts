import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { getTestWallet } from '../../src/support/runtime.js';
import {
  estimateBuyTokens,
  PUMP_CORE_FIXTURE,
  PUMP_CORE_PROGRAM_ID,
  PUMP_CORE_SDK,
  PUMP_CORE_PROTOCOL_ID,
} from './fixtures-core.js';
import { instructionPubkeys } from './helpers.js';

describe('Pump buy action', () => {
  it('matches the real Pump SDK buy instruction on the Pump program', async () => {
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

    expect(PUMP_CORE_PROGRAM_ID).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    expect(runtimePreview.programId).toBe(PUMP_CORE_PROGRAM_ID);
    expect(sdkInstruction.programId.toBase58()).toBe(PUMP_CORE_PROGRAM_ID);
    expect(prepared.accounts.user).toBe(PUMP_CORE_FIXTURE.wallet.toBase58());
    expect(prepared.accounts.global).toBe(PUMP_CORE_FIXTURE.globalPda.toBase58());
    expect(prepared.accounts.bonding_curve).toBe(PUMP_CORE_FIXTURE.bondingCurve.toBase58());
    expect(prepared.accounts.associated_bonding_curve).toBe(PUMP_CORE_FIXTURE.associatedBondingCurve.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      instructionPubkeys(sdkInstruction).slice(0, runtimePreview.keys.length),
    );
    expect(prepared.remainingAccounts.map((entry) => entry.pubkey)).toEqual(
      instructionPubkeys(sdkInstruction).slice(runtimePreview.keys.length),
    );
  });
});
