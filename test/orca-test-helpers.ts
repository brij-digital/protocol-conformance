import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
  getOracleAddress,
  getPositionAddress,
  getTickArrayAddress,
  type TickArrayArgs,
  type WhirlpoolArgs,
} from '@orca-so/whirlpools-client';
import { address, createNoopSigner } from '@solana/kit';
import {
  buildPositionArgs,
  buildWhirlpoolArgs,
  expectedTickArrayStarts,
  ORCA_WHIRLPOOL,
  POSITION_MINT,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_PROGRAM,
  toCoreTickArray,
  toCoreWhirlpool,
} from '../src/fixtures/orca.js';
import { getTestWallet, StaticAccountConnection } from '../src/support/runtime.js';

export type JsonRecord = Record<string, unknown>;

export type LoadedTickArray = {
  address: string;
  start_tick_index: number;
  ticks: Array<Record<string, unknown>>;
};

export function toComparable(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toComparable);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nested]) => [key, toComparable(nested)]),
    );
  }
  return value;
}

export async function getExpectedTickArrayAddresses(starts: number[]) {
  return Promise.all(
    starts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
  );
}

export function setTickArraysOnConnection(
  connection: StaticAccountConnection,
  addresses: string[],
  tickArrayArgs: TickArrayArgs[],
) {
  addresses.forEach((tickArrayAddress, index) => {
    connection.setTickArray(tickArrayAddress, tickArrayArgs[index]);
  });
}

export async function buildPositionBackedConnection(options?: {
  tickLowerIndex?: number;
  tickUpperIndex?: number;
  tickSpacing?: number;
  whirlpoolArgs?: WhirlpoolArgs;
}) {
  const connection = new StaticAccountConnection();
  const whirlpoolArgs =
    options?.whirlpoolArgs ??
    buildWhirlpoolArgs({
      tickSpacing: options?.tickSpacing ?? 64,
      tickCurrentIndex: 0,
    });
  connection.setWhirlpool(whirlpoolArgs);

  const [position] = await getPositionAddress(address(POSITION_MINT));
  const tickLowerIndex = options?.tickLowerIndex ?? -5632;
  const tickUpperIndex = options?.tickUpperIndex ?? 5632;
  connection.setPosition(
    position,
    buildPositionArgs({
      positionMint: POSITION_MINT,
      tickLowerIndex,
      tickUpperIndex,
    }),
  );
  connection.setRawAccount(POSITION_MINT, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_A, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_B, TOKEN_PROGRAM);

  return { connection, position, tickLowerIndex, tickUpperIndex, whirlpoolArgs };
}

export function toLoadedTickArray(addressValue: string, args: TickArrayArgs): LoadedTickArray {
  return {
    address: addressValue,
    start_tick_index: args.startTickIndex,
    ticks: args.ticks.map((tick) => ({
      initialized: tick.initialized,
      liquidity_net: tick.liquidityNet.toString(),
      liquidity_gross: tick.liquidityGross.toString(),
      fee_growth_outside_a: tick.feeGrowthOutsideA.toString(),
      fee_growth_outside_b: tick.feeGrowthOutsideB.toString(),
      reward_growths_outside: tick.rewardGrowthsOutside.map((value) => value.toString()),
    })),
  };
}

export function getLoadedTickArrays(view: { derived: Record<string, unknown> }): LoadedTickArray[] {
  const raw = view.derived.tick_arrays_data;
  if (!Array.isArray(raw)) {
    throw new Error('tick_arrays_data must be an array in the comparison harness.');
  }
  return raw as LoadedTickArray[];
}

export async function buildQuoteFixture(options: {
  whirlpoolArgs: WhirlpoolArgs;
  tickArrayArgs: TickArrayArgs[];
  aToB: boolean;
}) {
  const connection = new StaticAccountConnection();
  connection.setWhirlpool(options.whirlpoolArgs);

  const expectedStarts =
    options.tickArrayArgs.length === 3
      ? expectedTickArrayStarts({
          tickCurrentIndex: options.whirlpoolArgs.tickCurrentIndex,
          tickSpacing: options.whirlpoolArgs.tickSpacing,
          aToB: options.aToB,
        })
      : options.tickArrayArgs.map((tickArray) => tickArray.startTickIndex);
  const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
  setTickArraysOnConnection(connection, expectedAddresses, options.tickArrayArgs);

  return {
    connection,
    expectedStarts,
    expectedAddresses,
    coreWhirlpool: toCoreWhirlpool(options.whirlpoolArgs),
    coreTickArrays: options.tickArrayArgs.map(toCoreTickArray),
  };
}

export function toCamelSwapAccounts(accounts: Record<string, string>) {
  return {
    tokenProgramA: address(accounts.token_program_a),
    tokenProgramB: address(accounts.token_program_b),
    memoProgram: address(accounts.memo_program),
    tokenAuthority: createNoopSigner(address(accounts.token_authority)),
    whirlpool: address(accounts.whirlpool),
    tokenMintA: address(accounts.token_mint_a),
    tokenMintB: address(accounts.token_mint_b),
    tokenOwnerAccountA: address(accounts.token_owner_account_a),
    tokenVaultA: address(accounts.token_vault_a),
    tokenOwnerAccountB: address(accounts.token_owner_account_b),
    tokenVaultB: address(accounts.token_vault_b),
    tickArray0: address(accounts.tick_array0),
    tickArray1: address(accounts.tick_array1),
    tickArray2: address(accounts.tick_array2),
    oracle: address(accounts.oracle),
  };
}

export async function buildSwapExactInWriteInput(options: {
  amount: string;
  otherAmountThreshold: string;
  sqrtPriceLimit: string;
  amountSpecifiedIsInput: boolean;
  aToB: boolean;
  whirlpoolArgs: WhirlpoolArgs;
  tickArrays: string[];
}) {
  const expectedOracle = (await getOracleAddress(address(ORCA_WHIRLPOOL)))[0];
  return {
    amount: options.amount,
    other_amount_threshold: options.otherAmountThreshold,
    sqrt_price_limit: options.sqrtPriceLimit,
    amount_specified_is_input: options.amountSpecifiedIsInput,
    a_to_b: options.aToB,
    token_program_a: TOKEN_PROGRAM,
    token_program_b: TOKEN_PROGRAM,
    whirlpool: ORCA_WHIRLPOOL,
    token_mint_a: options.whirlpoolArgs.tokenMintA,
    token_mint_b: options.whirlpoolArgs.tokenMintB,
    token_vault_a: options.whirlpoolArgs.tokenVaultA,
    token_vault_b: options.whirlpoolArgs.tokenVaultB,
    tick_array0: options.tickArrays[0],
    tick_array1: options.tickArrays[1],
    tick_array2: options.tickArrays[2],
    oracle: expectedOracle,
  };
}

export function getWalletAta(mint: string, tokenProgram = TOKEN_PROGRAM) {
  return getAssociatedTokenAddressSync(
    new PublicKey(mint),
    new PublicKey(TEST_WALLET),
    false,
    new PublicKey(tokenProgram),
  ).toBase58();
}

export { getTestWallet };
