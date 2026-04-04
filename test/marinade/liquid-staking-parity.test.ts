import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import { BN } from '@marinade.finance/marinade-ts-sdk';
import { describe, expect, it } from 'vitest';
import '../../src/support/runtime.js';
import {
  buildOfflineMarinade,
  MARINADE_FIXTURE,
  MARINADE_PROGRAM_ID,
  MARINADE_PROTOCOL_ID,
  TICKET_ACCOUNT_RENT_LAMPORTS,
} from './fixtures.js';

function comparableKeys(
  keys: Array<{ pubkey: { toBase58(): string } | string; isSigner: boolean; isWritable: boolean }>,
) {
  return keys.map((entry) => ({
    pubkey: typeof entry.pubkey === 'string' ? entry.pubkey : entry.pubkey.toBase58(),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

describe('Marinade liquid staking parity', () => {
  it('matches SDK instruction encoding for deposit', async () => {
    const { marinade } = await buildOfflineMarinade();
    const amountLamports = '1500000000';

    const prepared = await prepareRuntimeInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'deposit',
      input: {
        lamports: amountLamports,
      },
      connection: {} as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });
    const sdkDeposit = await marinade.deposit(new BN(prepared.args.lamports as string));
    const sdkInstruction = sdkDeposit.transaction.instructions.at(-1);

    expect(sdkInstruction).toBeDefined();
    expect(prepared.accounts.state).toBe(MARINADE_FIXTURE.state.toBase58());
    expect(prepared.accounts.reserve_pda).toBe(MARINADE_FIXTURE.reservePda.toBase58());
    expect(prepared.accounts.msol_mint_authority).toBe(MARINADE_FIXTURE.msolMintAuthority.toBase58());
    expect(prepared.accounts.liq_pool_sol_leg_pda).toBe(MARINADE_FIXTURE.liqPoolSolLegPda.toBase58());
    expect(prepared.accounts.mint_to).toBe(MARINADE_FIXTURE.msolTokenAccount.toBase58());
    expect(prepared.preInstructions).toHaveLength(1);
    expect(runtimePreview.programId).toBe(MARINADE_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction!.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction!.keys));
  });

  it('matches SDK instruction encoding for order_unstake', async () => {
    const { marinade } = await buildOfflineMarinade();
    const msolAmount = '420000000';

    const prepared = await prepareRuntimeInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'order_unstake',
      input: {
        msol_amount: msolAmount,
        new_ticket_account: MARINADE_FIXTURE.ticketAccount.toBase58(),
      },
      connection: {} as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });
    const sdkOrderUnstake = await marinade.orderUnstakeWithPublicKey(
      new BN(prepared.args.msol_amount as string),
      MARINADE_FIXTURE.ticketAccount,
    );
    const sdkInstruction = sdkOrderUnstake.transaction.instructions[1];

    expect(sdkInstruction).toBeDefined();
    expect(sdkOrderUnstake.transaction.instructions[0]?.programId.toBase58()).toBe(
      '11111111111111111111111111111111',
    );
    expect(prepared.accounts.burn_msol_from).toBe(MARINADE_FIXTURE.msolTokenAccount.toBase58());
    expect(prepared.accounts.new_ticket_account).toBe(MARINADE_FIXTURE.ticketAccount.toBase58());
    expect(runtimePreview.programId).toBe(MARINADE_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys));
  });

  it('derives Marinade PDAs consistently with MarinadeState helpers', async () => {
    const { marinadeState } = await buildOfflineMarinade();
    const view = await runRuntimeView({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'derive_accounts',
      input: {
        owner: MARINADE_FIXTURE.wallet.toBase58(),
        validator_vote: MARINADE_FIXTURE.validatorVote.toBase58(),
      },
      connection: {} as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    expect(view.derived.reserve_pda).toBe((await marinadeState.reserveAddress()).toBase58());
    expect(view.derived.msol_mint_authority).toBe((await marinadeState.mSolMintAuthority()).toBase58());
    expect(view.derived.liq_pool_msol_leg_authority).toBe((await marinadeState.mSolLegAuthority()).toBase58());
    expect(view.derived.liq_pool_sol_leg_pda).toBe((await marinadeState.solLeg()).toBase58());
    expect(view.derived.stake_deposit_authority).toBe((await marinadeState.stakeDepositAuthority()).toBase58());
    expect(view.derived.stake_withdraw_authority).toBe((await marinadeState.stakeWithdrawAuthority()).toBase58());
  });

  it('derives the validator duplication flag, mSOL ATA, and runtime constants correctly', async () => {
    const view = await runRuntimeView({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'derive_accounts',
      input: {
        owner: MARINADE_FIXTURE.wallet.toBase58(),
        validator_vote: MARINADE_FIXTURE.validatorVote.toBase58(),
      },
      connection: {} as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    expect(view.derived.validator_duplication_flag).toBe(MARINADE_FIXTURE.validatorDuplicationFlag.toBase58());
    expect(view.derived.msol_token_account).toBe(MARINADE_FIXTURE.msolTokenAccount.toBase58());
    expect(MARINADE_FIXTURE.tokenProgram.toBase58()).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(MARINADE_FIXTURE.clock.toBase58()).toBe('SysvarC1ock11111111111111111111111111111111');
    expect(MARINADE_FIXTURE.rent.toBase58()).toBe('SysvarRent111111111111111111111111111111111');
    expect(TICKET_ACCOUNT_RENT_LAMPORTS).toBeGreaterThan(0);
  });
});
