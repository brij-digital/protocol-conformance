import BN from 'bn.js';
import { makeSwapFixedInInstruction } from '@raydium-io/raydium-sdk-v2';
import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import '../../src/support/runtime.js';
import {
  OPENBOOK_PROGRAM_ID,
  RAYDIUM_AMM_FIXTURE,
  RAYDIUM_AMM_PROGRAM_ID,
  RAYDIUM_AMM_PROTOCOL_ID,
  RAYDIUM_POOL_KEYS,
} from './fixtures.js';

function comparableKeys(
  keys: Array<{ pubkey: unknown; isSigner: boolean; isWritable: boolean }>,
): Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }> {
  return keys.map((entry) => ({
    pubkey: comparablePubkey(entry.pubkey),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

function comparablePubkey(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof PublicKey) {
    return value.toBase58();
  }
  if (value && typeof value === 'object' && '_bn' in value) {
    const candidate = value as {
      _bn?: {
        negative?: number;
        words?: number[];
        length?: number;
      };
    };
    if (candidate._bn?.words && typeof candidate._bn.length === 'number') {
      const bn = Object.assign(new BN(0), {
        negative: candidate._bn.negative ?? 0,
        words: candidate._bn.words,
        length: candidate._bn.length,
        red: null,
      });
      return new PublicKey(bn.toArrayLike(Buffer, 'be', 32)).toBase58();
    }
  }
  return new PublicKey(value as ConstructorParameters<typeof PublicKey>[0]).toBase58();
}

describe('Raydium swap action', () => {
  it('matches the real Raydium SDK AMM swap instruction on the Raydium program', async () => {
    const amountIn = new BN('1500000');
    const minAmountOut = new BN('1400000');

    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      operationId: 'swap_base_in',
      input: {
        token_program: RAYDIUM_AMM_FIXTURE.tokenProgram.toBase58(),
        pool: RAYDIUM_AMM_FIXTURE.pool.toBase58(),
        authority: RAYDIUM_AMM_FIXTURE.authority.toBase58(),
        open_orders: RAYDIUM_AMM_FIXTURE.openOrders.toBase58(),
        target_orders: RAYDIUM_AMM_FIXTURE.targetOrders.toBase58(),
        base_vault: RAYDIUM_AMM_FIXTURE.baseVault.toBase58(),
        quote_vault: RAYDIUM_AMM_FIXTURE.quoteVault.toBase58(),
        market_program: OPENBOOK_PROGRAM_ID.toBase58(),
        market: RAYDIUM_AMM_FIXTURE.market.toBase58(),
        market_bids: RAYDIUM_AMM_FIXTURE.marketBids.toBase58(),
        market_asks: RAYDIUM_AMM_FIXTURE.marketAsks.toBase58(),
        market_event_queue: RAYDIUM_AMM_FIXTURE.marketEventQueue.toBase58(),
        market_base_vault: RAYDIUM_AMM_FIXTURE.marketBaseVault.toBase58(),
        market_quote_vault: RAYDIUM_AMM_FIXTURE.marketQuoteVault.toBase58(),
        market_authority: RAYDIUM_AMM_FIXTURE.marketAuthority.toBase58(),
        user_token_in: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_token_out: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        amount_in: amountIn.toString(),
        min_amount_out: minAmountOut.toString(),
      },
      connection: {} as never,
      walletPublicKey: RAYDIUM_AMM_FIXTURE.wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: RAYDIUM_AMM_FIXTURE.wallet,
    });
    const sdkInstruction = makeSwapFixedInInstruction(
      {
        poolKeys: RAYDIUM_POOL_KEYS as never,
        userKeys: {
          tokenAccountIn: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount,
          tokenAccountOut: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount,
          owner: RAYDIUM_AMM_FIXTURE.wallet,
        },
        amountIn,
        minAmountOut,
      },
      4,
    );

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(prepared.accounts.owner).toBe(RAYDIUM_AMM_FIXTURE.wallet.toBase58());
    expect(prepared.accounts.pool).toBe(RAYDIUM_AMM_FIXTURE.pool.toBase58());
    expect(prepared.accounts.user_token_in).toBe(RAYDIUM_AMM_FIXTURE.userBaseTokenAccount.toBase58());
    expect(prepared.accounts.user_token_out).toBe(RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
    expect(prepared.remainingAccounts).toEqual([]);
  });
});
