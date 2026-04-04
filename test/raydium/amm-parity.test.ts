import BN from 'bn.js';
import {
  makeAddLiquidityInstruction,
  makeSwapFixedInInstruction,
  makeSwapFixedOutInstruction,
  removeLiquidityInstruction,
} from '@raydium-io/raydium-sdk-v2';
import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import {
  OPENBOOK_PROGRAM_ID,
  RAYDIUM_AMM_FIXTURE,
  RAYDIUM_AMM_PROGRAM_ID,
  RAYDIUM_AMM_PROTOCOL_ID,
  RAYDIUM_POOL_INFO,
  RAYDIUM_POOL_KEYS,
} from './fixtures.js';

function comparableKeys(
  keys: Array<{ pubkey: { toBase58(): string }; isSigner: boolean; isWritable: boolean }>,
): Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }> {
  return keys.map((entry) => ({
    pubkey: entry.pubkey.toBase58(),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

describe('Raydium AMM parity', () => {
  it('matches SDK instruction encoding for swap_base_in', async () => {
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
        amount_in: '1500000',
        min_amount_out: '1400000',
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
        amountIn: new BN(prepared.args.amount_in as string),
        minAmountOut: new BN(prepared.args.min_amount_out as string),
      },
      4,
    );

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
  });

  it('matches SDK instruction encoding for swap_base_out', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      operationId: 'swap_base_out',
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
        max_amount_in: '900000',
        amount_out: '850000',
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
    const sdkInstruction = makeSwapFixedOutInstruction(
      {
        poolKeys: RAYDIUM_POOL_KEYS as never,
        userKeys: {
          tokenAccountIn: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount,
          tokenAccountOut: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount,
          owner: RAYDIUM_AMM_FIXTURE.wallet,
        },
        maxAmountIn: new BN(prepared.args.max_amount_in as string),
        amountOut: new BN(prepared.args.amount_out as string),
      },
      4,
    );

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
  });

  it('matches SDK instruction encoding for add_liquidity_fixed_base', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      operationId: 'add_liquidity_fixed_base',
      input: {
        token_program: RAYDIUM_AMM_FIXTURE.tokenProgram.toBase58(),
        pool: RAYDIUM_AMM_FIXTURE.pool.toBase58(),
        authority: RAYDIUM_AMM_FIXTURE.authority.toBase58(),
        open_orders: RAYDIUM_AMM_FIXTURE.openOrders.toBase58(),
        target_orders: RAYDIUM_AMM_FIXTURE.targetOrders.toBase58(),
        lp_mint: RAYDIUM_AMM_FIXTURE.lpMint.toBase58(),
        base_vault: RAYDIUM_AMM_FIXTURE.baseVault.toBase58(),
        quote_vault: RAYDIUM_AMM_FIXTURE.quoteVault.toBase58(),
        market: RAYDIUM_AMM_FIXTURE.market.toBase58(),
        user_base_token_account: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_quote_token_account: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        user_lp_token_account: RAYDIUM_AMM_FIXTURE.userLpTokenAccount.toBase58(),
        market_event_queue: RAYDIUM_AMM_FIXTURE.marketEventQueue.toBase58(),
        base_amount_in: '2000000',
        quote_amount_in: '6000000',
        other_amount_min: '5900000',
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
    const sdkInstruction = makeAddLiquidityInstruction({
      poolInfo: RAYDIUM_POOL_INFO as never,
      poolKeys: RAYDIUM_POOL_KEYS as never,
      userKeys: {
        baseTokenAccount: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount,
        quoteTokenAccount: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount,
        lpTokenAccount: RAYDIUM_AMM_FIXTURE.userLpTokenAccount,
        owner: RAYDIUM_AMM_FIXTURE.wallet,
      },
      baseAmountIn: new BN(prepared.args.base_amount_in as string),
      quoteAmountIn: new BN(prepared.args.quote_amount_in as string),
      otherAmountMin: new BN(prepared.args.other_amount_min as string),
      fixedSide: 'base',
    } as never);

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
  });

  it('matches SDK instruction encoding for add_liquidity_fixed_quote', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      operationId: 'add_liquidity_fixed_quote',
      input: {
        token_program: RAYDIUM_AMM_FIXTURE.tokenProgram.toBase58(),
        pool: RAYDIUM_AMM_FIXTURE.pool.toBase58(),
        authority: RAYDIUM_AMM_FIXTURE.authority.toBase58(),
        open_orders: RAYDIUM_AMM_FIXTURE.openOrders.toBase58(),
        target_orders: RAYDIUM_AMM_FIXTURE.targetOrders.toBase58(),
        lp_mint: RAYDIUM_AMM_FIXTURE.lpMint.toBase58(),
        base_vault: RAYDIUM_AMM_FIXTURE.baseVault.toBase58(),
        quote_vault: RAYDIUM_AMM_FIXTURE.quoteVault.toBase58(),
        market: RAYDIUM_AMM_FIXTURE.market.toBase58(),
        user_base_token_account: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_quote_token_account: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        user_lp_token_account: RAYDIUM_AMM_FIXTURE.userLpTokenAccount.toBase58(),
        market_event_queue: RAYDIUM_AMM_FIXTURE.marketEventQueue.toBase58(),
        base_amount_in: '1800000',
        quote_amount_in: '5400000',
        other_amount_min: '1700000',
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
    const sdkInstruction = makeAddLiquidityInstruction({
      poolInfo: RAYDIUM_POOL_INFO as never,
      poolKeys: RAYDIUM_POOL_KEYS as never,
      userKeys: {
        baseTokenAccount: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount,
        quoteTokenAccount: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount,
        lpTokenAccount: RAYDIUM_AMM_FIXTURE.userLpTokenAccount,
        owner: RAYDIUM_AMM_FIXTURE.wallet,
      },
      baseAmountIn: new BN(prepared.args.base_amount_in as string),
      quoteAmountIn: new BN(prepared.args.quote_amount_in as string),
      otherAmountMin: new BN(prepared.args.other_amount_min as string),
      fixedSide: 'quote',
    } as never);

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
  });

  it('matches SDK instruction encoding for remove_liquidity', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: RAYDIUM_AMM_PROTOCOL_ID,
      operationId: 'remove_liquidity',
      input: {
        token_program: RAYDIUM_AMM_FIXTURE.tokenProgram.toBase58(),
        pool: RAYDIUM_AMM_FIXTURE.pool.toBase58(),
        authority: RAYDIUM_AMM_FIXTURE.authority.toBase58(),
        open_orders: RAYDIUM_AMM_FIXTURE.openOrders.toBase58(),
        target_orders: RAYDIUM_AMM_FIXTURE.targetOrders.toBase58(),
        lp_mint: RAYDIUM_AMM_FIXTURE.lpMint.toBase58(),
        base_vault: RAYDIUM_AMM_FIXTURE.baseVault.toBase58(),
        quote_vault: RAYDIUM_AMM_FIXTURE.quoteVault.toBase58(),
        withdraw_queue: RAYDIUM_AMM_FIXTURE.withdrawQueue.toBase58(),
        temp_lp_token_account: RAYDIUM_AMM_FIXTURE.tempLpTokenAccount.toBase58(),
        market_program: OPENBOOK_PROGRAM_ID.toBase58(),
        market: RAYDIUM_AMM_FIXTURE.market.toBase58(),
        market_base_vault: RAYDIUM_AMM_FIXTURE.marketBaseVault.toBase58(),
        market_quote_vault: RAYDIUM_AMM_FIXTURE.marketQuoteVault.toBase58(),
        market_authority: RAYDIUM_AMM_FIXTURE.marketAuthority.toBase58(),
        user_lp_token_account: RAYDIUM_AMM_FIXTURE.userLpTokenAccount.toBase58(),
        user_base_token_account: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_quote_token_account: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        market_event_queue: RAYDIUM_AMM_FIXTURE.marketEventQueue.toBase58(),
        market_bids: RAYDIUM_AMM_FIXTURE.marketBids.toBase58(),
        market_asks: RAYDIUM_AMM_FIXTURE.marketAsks.toBase58(),
        lp_amount: '250000',
        base_amount_min: '120000',
        quote_amount_min: '360000',
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
    const sdkInstruction = removeLiquidityInstruction({
      poolInfo: RAYDIUM_POOL_INFO as never,
      poolKeys: RAYDIUM_POOL_KEYS as never,
      userKeys: {
        lpTokenAccount: RAYDIUM_AMM_FIXTURE.userLpTokenAccount,
        baseTokenAccount: RAYDIUM_AMM_FIXTURE.userBaseTokenAccount,
        quoteTokenAccount: RAYDIUM_AMM_FIXTURE.userQuoteTokenAccount,
        owner: RAYDIUM_AMM_FIXTURE.wallet,
      },
      lpAmount: new BN(prepared.args.lp_amount as string),
      baseAmountMin: new BN(prepared.args.base_amount_min as string),
      quoteAmountMin: new BN(prepared.args.quote_amount_min as string),
    } as never);

    expect(runtimePreview.programId).toBe(RAYDIUM_AMM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.keys as never));
  });
});
