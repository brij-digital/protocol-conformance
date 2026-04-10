import BN from 'bn.js';
import { createRequire } from 'node:module';
import { PublicKey } from '@solana/web3.js';
import { prepareRuntimeInstruction } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

const require = createRequire(import.meta.url);
const DLMM = require('@meteora-ag/dlmm') as typeof import('@meteora-ag/dlmm');
const {
  IDL,
  StrategyType,
  createProgram,
  deriveBinArray,
  deriveBinArrayBitmapExtension,
  deriveEventAuthority,
  deriveOracle,
  derivePosition,
  deriveReserve,
  toStrategyParameters,
} = DLMM;

const PROGRAM_ID = new PublicKey(IDL.address);
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const PROTOCOL_ID = 'meteora-dlmm-mainnet';
const wallet = getTestWallet();
const connection = new StaticAccountConnection() as unknown;
const program = createProgram(connection as never);

const lbPair = new PublicKey('8opHzTAnfzRpPEx21XtnrVTX28YQuCpAjcn1PczScKh');
const tokenXMint = new PublicKey('So11111111111111111111111111111111111111112');
const tokenYMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const reserveX = deriveReserve(lbPair, tokenXMint, PROGRAM_ID)[0];
const reserveY = deriveReserve(lbPair, tokenYMint, PROGRAM_ID)[0];
const oracle = deriveOracle(lbPair, PROGRAM_ID)[0];
const eventAuthority = deriveEventAuthority(PROGRAM_ID)[0];
const binArrayBitmapExtension = deriveBinArrayBitmapExtension(lbPair, PROGRAM_ID)[0];
const userTokenX = new PublicKey('4q2wPZM5zN56ZWRPc8E9vrFica8FWHZpizxgxYkWwaRM');
const userTokenY = new PublicKey('8J6xDcV1YQUAECEV4VpWwfvX2VNfzQExgkt1PyfuzMdG');
const base = new PublicKey('2q7pyhPw8QF4Hq1mRk2nrXL6N3iNf2A7Fp8ZUBKbjrKM');
const position = derivePosition(lbPair, base, new BN(-35), new BN(70), PROGRAM_ID)[0];
const remainingAccountPubkeys = [
  deriveBinArray(lbPair, new BN(-1), PROGRAM_ID)[0],
  deriveBinArray(lbPair, new BN(0), PROGRAM_ID)[0],
  deriveBinArray(lbPair, new BN(1), PROGRAM_ID)[0],
];
const remainingAccounts = remainingAccountPubkeys.map((pubkey) => ({
  pubkey: pubkey.toBase58(),
  isSigner: false,
  isWritable: true,
}));
const sdkRemainingAccounts = remainingAccountPubkeys.map((pubkey) => ({
  pubkey,
  isSigner: false,
  isWritable: true,
}));
const remainingAccountsInfo = { slices: [] };

function comparableKeys(
  keys: Array<{ pubkey: { toBase58(): string } | string; isSigner: boolean; isWritable: boolean }>,
) {
  return keys.map((entry) => ({
    pubkey: typeof entry.pubkey === 'string' ? entry.pubkey : entry.pubkey.toBase58(),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelizeKeys<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [snakeToCamel(key), nested]));
}

describe('Meteora DLMM actions', () => {
  it('matches SDK instruction encoding for swap', async () => {
    const amountIn = '1000000';
    const minAmountOut = '975000';

    const prepared = await prepareRuntimeInstruction({
      protocolId: PROTOCOL_ID,
      operationId: 'swap',
      input: {
        lb_pair: lbPair.toBase58(),
        bin_array_bitmap_extension: binArrayBitmapExtension.toBase58(),
        reserve_x: reserveX.toBase58(),
        reserve_y: reserveY.toBase58(),
        user_token_in: userTokenX.toBase58(),
        user_token_out: userTokenY.toBase58(),
        token_x_mint: tokenXMint.toBase58(),
        token_y_mint: tokenYMint.toBase58(),
        oracle: oracle.toBase58(),
        event_authority: eventAuthority.toBase58(),
        token_x_program: TOKEN_PROGRAM,
        token_y_program: TOKEN_PROGRAM,
        amount_in: amountIn,
        min_amount_out: minAmountOut,
        remaining_accounts_info: remainingAccountsInfo,
        remaining_accounts: remainingAccounts,
      },
      connection: connection as never,
      walletPublicKey: wallet,
    });

    const runtimeInstruction = await program.methods
      .swap2(
        new BN(prepared.args.amount_in as string),
        new BN(prepared.args.min_amount_out as string),
        prepared.args.remaining_accounts_info as never,
      )
      .accountsPartial({
        ...camelizeKeys(prepared.accounts),
        hostFeeIn: null,
      })
      .remainingAccounts(
        prepared.remainingAccounts.map((entry) => ({
          ...entry,
          pubkey: new PublicKey(entry.pubkey),
        })),
      )
      .instruction();

    const sdkInstruction = await program.methods
      .swap2(new BN(amountIn), new BN(minAmountOut), remainingAccountsInfo as never)
      .accountsPartial({
        lbPair,
        binArrayBitmapExtension,
        reserveX,
        reserveY,
        userTokenIn: userTokenX,
        userTokenOut: userTokenY,
        tokenXMint,
        tokenYMint,
        oracle,
        user: wallet,
        tokenXProgram: new PublicKey(TOKEN_PROGRAM),
        tokenYProgram: new PublicKey(TOKEN_PROGRAM),
        memoProgram: new PublicKey(MEMO_PROGRAM),
        hostFeeIn: null,
        eventAuthority,
        program: PROGRAM_ID,
      })
      .remainingAccounts(sdkRemainingAccounts)
      .instruction();

    expect(prepared.accounts.user).toBe(wallet.toBase58());
    expect(Buffer.from(runtimeInstruction.data)).toEqual(Buffer.from(sdkInstruction.data));
    expect(comparableKeys(runtimeInstruction.keys)).toEqual(comparableKeys(sdkInstruction.keys));
  });

  it('matches SDK instruction encoding for add_liquidity', async () => {
    const strategyParameters = toStrategyParameters({
      minBinId: -35,
      maxBinId: 34,
      strategyType: StrategyType.Spot,
      singleSidedX: false,
    });
    const liquidityParameter = {
      amount_x: '1500000',
      amount_y: '2500000',
      active_id: 0,
      max_active_bin_slippage: 3,
      strategy_parameters: {
        ...strategyParameters,
        strategy_type: { __kind: 'SpotImBalanced' },
      },
    };

    const prepared = await prepareRuntimeInstruction({
      protocolId: PROTOCOL_ID,
      operationId: 'add_liquidity',
      input: {
        position: position.toBase58(),
        lb_pair: lbPair.toBase58(),
        bin_array_bitmap_extension: binArrayBitmapExtension.toBase58(),
        user_token_x: userTokenX.toBase58(),
        user_token_y: userTokenY.toBase58(),
        reserve_x: reserveX.toBase58(),
        reserve_y: reserveY.toBase58(),
        token_x_mint: tokenXMint.toBase58(),
        token_y_mint: tokenYMint.toBase58(),
        token_x_program: TOKEN_PROGRAM,
        token_y_program: TOKEN_PROGRAM,
        event_authority: eventAuthority.toBase58(),
        liquidity_parameter: liquidityParameter,
        remaining_accounts_info: remainingAccountsInfo,
        remaining_accounts: remainingAccounts,
      },
      connection: connection as never,
      walletPublicKey: wallet,
    });

    const runtimeInstruction = await program.methods
      .addLiquidityByStrategy2(
        prepared.args.liquidity_parameter as never,
        prepared.args.remaining_accounts_info as never,
      )
      .accountsPartial(camelizeKeys(prepared.accounts))
      .remainingAccounts(
        prepared.remainingAccounts.map((entry) => ({
          ...entry,
          pubkey: new PublicKey(entry.pubkey),
        })),
      )
      .instruction();

    const sdkInstruction = await program.methods
      .addLiquidityByStrategy2(liquidityParameter as never, remainingAccountsInfo as never)
      .accountsPartial({
        position,
        lbPair,
        binArrayBitmapExtension,
        userTokenX,
        userTokenY,
        reserveX,
        reserveY,
        tokenXMint,
        tokenYMint,
        sender: wallet,
        tokenXProgram: new PublicKey(TOKEN_PROGRAM),
        tokenYProgram: new PublicKey(TOKEN_PROGRAM),
        eventAuthority,
        program: PROGRAM_ID,
      })
      .remainingAccounts(sdkRemainingAccounts)
      .instruction();

    expect(prepared.accounts.sender).toBe(wallet.toBase58());
    expect(Buffer.from(runtimeInstruction.data)).toEqual(Buffer.from(sdkInstruction.data));
    expect(comparableKeys(runtimeInstruction.keys)).toEqual(comparableKeys(sdkInstruction.keys));
  });

  it('matches SDK instruction encoding for remove_liquidity', async () => {
    const fromBinId = -35;
    const toBinId = 34;
    const bpsToRemove = 10_000;

    const prepared = await prepareRuntimeInstruction({
      protocolId: PROTOCOL_ID,
      operationId: 'remove_liquidity',
      input: {
        position: position.toBase58(),
        lb_pair: lbPair.toBase58(),
        bin_array_bitmap_extension: binArrayBitmapExtension.toBase58(),
        user_token_x: userTokenX.toBase58(),
        user_token_y: userTokenY.toBase58(),
        reserve_x: reserveX.toBase58(),
        reserve_y: reserveY.toBase58(),
        token_x_mint: tokenXMint.toBase58(),
        token_y_mint: tokenYMint.toBase58(),
        token_x_program: TOKEN_PROGRAM,
        token_y_program: TOKEN_PROGRAM,
        event_authority: eventAuthority.toBase58(),
        from_bin_id: fromBinId,
        to_bin_id: toBinId,
        bps_to_remove: bpsToRemove,
        remaining_accounts_info: remainingAccountsInfo,
        remaining_accounts: remainingAccounts,
      },
      connection: connection as never,
      walletPublicKey: wallet,
    });

    const runtimeInstruction = await program.methods
      .removeLiquidityByRange2(
        prepared.args.from_bin_id as number,
        prepared.args.to_bin_id as number,
        prepared.args.bps_to_remove as number,
        prepared.args.remaining_accounts_info as never,
      )
      .accountsPartial(camelizeKeys(prepared.accounts))
      .remainingAccounts(
        prepared.remainingAccounts.map((entry) => ({
          ...entry,
          pubkey: new PublicKey(entry.pubkey),
        })),
      )
      .instruction();

    const sdkInstruction = await program.methods
      .removeLiquidityByRange2(fromBinId, toBinId, bpsToRemove, remainingAccountsInfo as never)
      .accountsPartial({
        position,
        lbPair,
        binArrayBitmapExtension,
        userTokenX,
        userTokenY,
        reserveX,
        reserveY,
        tokenXMint,
        tokenYMint,
        sender: wallet,
        tokenXProgram: new PublicKey(TOKEN_PROGRAM),
        tokenYProgram: new PublicKey(TOKEN_PROGRAM),
        memoProgram: new PublicKey(MEMO_PROGRAM),
        eventAuthority,
        program: PROGRAM_ID,
      })
      .remainingAccounts(sdkRemainingAccounts)
      .instruction();

    expect(prepared.accounts.sender).toBe(wallet.toBase58());
    expect(Buffer.from(runtimeInstruction.data)).toEqual(Buffer.from(sdkInstruction.data));
    expect(comparableKeys(runtimeInstruction.keys)).toEqual(comparableKeys(sdkInstruction.keys));
  });
});
