import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { BN } from '@marinade.finance/marinade-ts-sdk';
import { describe, expect, it } from 'vitest';
import '../../src/support/runtime.js';
import { buildOfflineMarinade, MARINADE_FIXTURE, MARINADE_PROGRAM_ID, MARINADE_PROTOCOL_ID } from './fixtures.js';

function comparableKeys(
  keys: Array<{ pubkey: { toBase58(): string } | string; isSigner: boolean; isWritable: boolean }>,
) {
  return keys.map((entry) => ({
    pubkey: typeof entry.pubkey === 'string' ? entry.pubkey : entry.pubkey.toBase58(),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

describe('Marinade actions', () => {
  it('matches SDK instruction encoding for liquid_unstake', async () => {
    const { marinade, connection } = await buildOfflineMarinade();
    const msolAmount = '210000000';

    const prepared = await prepareRuntimeInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'liquid_unstake',
      input: {
        msol_amount: msolAmount,
      },
      connection: connection as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });
    const sdkLiquidUnstake = await marinade.liquidUnstake(
      new BN(prepared.args.msol_amount as string),
      MARINADE_FIXTURE.msolTokenAccount,
    );
    const sdkInstruction = sdkLiquidUnstake.transaction.instructions.at(-1);

    expect(sdkInstruction).toBeDefined();
    expect(prepared.accounts.get_msol_from).toBe(MARINADE_FIXTURE.msolTokenAccount.toBase58());
    expect(prepared.accounts.liq_pool_sol_leg_pda).toBe(MARINADE_FIXTURE.liqPoolSolLegPda.toBase58());
    expect(prepared.accounts.transfer_sol_to).toBe(MARINADE_FIXTURE.wallet.toBase58());
    expect(runtimePreview.programId).toBe(MARINADE_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction!.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction!.keys));
  });

  it('matches SDK instruction encoding for claim', async () => {
    const { marinade, connection } = await buildOfflineMarinade();

    const prepared = await prepareRuntimeInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      operationId: 'claim',
      input: {
        ticket_account: MARINADE_FIXTURE.ticketAccount.toBase58(),
      },
      connection: connection as never,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: MARINADE_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: MARINADE_FIXTURE.wallet,
    });
    const sdkClaim = await marinade.claim(MARINADE_FIXTURE.ticketAccount);
    const sdkInstruction = sdkClaim.transaction.instructions.at(-1);

    expect(sdkInstruction).toBeDefined();
    expect(prepared.accounts.reserve_pda).toBe(MARINADE_FIXTURE.reservePda.toBase58());
    expect(prepared.accounts.ticket_account).toBe(MARINADE_FIXTURE.ticketAccount.toBase58());
    expect(prepared.accounts.transfer_sol_to).toBe(MARINADE_FIXTURE.wallet.toBase58());
    expect(runtimePreview.programId).toBe(MARINADE_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction!.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction!.keys));
  });
});
