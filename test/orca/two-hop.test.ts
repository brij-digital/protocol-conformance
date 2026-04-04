import { describe, expect, it } from 'vitest';
import {
  getOracleAddress,
  getTickArrayAddress,
  getTwoHopSwapV2Instruction,
  type TickArrayArgs,
  type WhirlpoolArgs,
} from '@orca-so/whirlpools-client';
import { swapQuoteByInputToken } from '@orca-so/whirlpools-core';
import { address } from '@solana/kit';
import {
  prepareRuntimeInstruction,
  previewIdlInstruction,
  runRuntimeView,
} from '@brij-digital/apppack-runtime';
import {
  buildCustomTickArrayArgs,
  buildWhirlpoolArgs,
  ORCA_WHIRLPOOL,
  ORCA_WHIRLPOOL_TWO,
  POSITION_MINT,
  REWARD_VAULTS,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_MINT_C,
  TOKEN_PROGRAM,
  toCoreTickArray,
  toCoreWhirlpool,
} from '../src/fixtures/orca.js';
import { StaticAccountConnection, getTestWallet } from '../src/support/runtime.js';
import {
  buildTwoHopSwapV2WriteInput,
  getExpectedTickArrayAddressesForWhirlpool,
  getWalletAta,
  toCamelTwoHopSwapAccounts,
} from './orca-test-helpers.js';

type TwoHopVector = {
  name: string;
  whirlpoolOne: string;
  whirlpoolTwo: string;
  whirlpoolOneArgs: WhirlpoolArgs;
  whirlpoolTwoArgs: WhirlpoolArgs;
  tickArraysOneArgs: TickArrayArgs[];
  tickArraysTwoArgs: TickArrayArgs[];
  tokenInMint: string;
  tokenIntermediateMint: string;
  tokenOutMint: string;
  amountIn: string;
  slippageBps: string;
  aToBOne: boolean;
  aToBTwo: boolean;
};

function getPreparedBoolArg(args: Record<string, unknown>, compact: string, snake?: string) {
  return Boolean(args[compact] ?? (snake ? args[snake] : undefined));
}

async function buildTwoHopFixture(vector: TwoHopVector) {
  const connection = new StaticAccountConnection();
  connection.setWhirlpoolAt(vector.whirlpoolOne, vector.whirlpoolOneArgs);
  connection.setWhirlpoolAt(vector.whirlpoolTwo, vector.whirlpoolTwoArgs);

  const startsOne = expectedTickArrayStarts(
    vector.whirlpoolOneArgs.tickCurrentIndex,
    vector.whirlpoolOneArgs.tickSpacing,
    vector.aToBOne,
  );
  const startsTwo = expectedTickArrayStarts(
    vector.whirlpoolTwoArgs.tickCurrentIndex,
    vector.whirlpoolTwoArgs.tickSpacing,
    vector.aToBTwo,
  );
  const tickArraysOne = await getExpectedTickArrayAddressesForWhirlpool(vector.whirlpoolOne, startsOne);
  const tickArraysTwo = await getExpectedTickArrayAddressesForWhirlpool(vector.whirlpoolTwo, startsTwo);

  tickArraysOne.forEach((tickArray, index) => {
    connection.setTickArray(tickArray, vector.tickArraysOneArgs[index]);
  });
  tickArraysTwo.forEach((tickArray, index) => {
    connection.setTickArray(tickArray, vector.tickArraysTwoArgs[index]);
  });

  connection.setRawAccount(vector.tokenInMint, TOKEN_PROGRAM);
  connection.setRawAccount(vector.tokenIntermediateMint, TOKEN_PROGRAM);
  connection.setRawAccount(vector.tokenOutMint, TOKEN_PROGRAM);

  return { connection, tickArraysOne, tickArraysTwo };
}

function expectedTickArrayStarts(tickCurrentIndex: number, tickSpacing: number, aToB: boolean) {
  const ticksPerArray = tickSpacing * 88;
  if (aToB) {
    const currentStart = Math.floor(tickCurrentIndex / ticksPerArray) * ticksPerArray;
    return [currentStart, currentStart - ticksPerArray, currentStart - 2 * ticksPerArray];
  }

  const shifted = tickCurrentIndex + tickSpacing;
  const currentStart = Math.floor(shifted / ticksPerArray) * ticksPerArray;
  return [currentStart, currentStart + ticksPerArray, currentStart + 2 * ticksPerArray];
}

function expectedVaults(args: WhirlpoolArgs, aToB: boolean) {
  return aToB
    ? {
        input: args.tokenVaultA,
        output: args.tokenVaultB,
      }
    : {
        input: args.tokenVaultB,
        output: args.tokenVaultA,
      };
}

function buildVectorOne(): TwoHopVector {
  const whirlpoolOneArgs = buildWhirlpoolArgs({
    tickCurrentIndex: 120,
    tickSpacing: 4,
    sqrtPrice: 1n << 64n,
    feeRate: 1800,
    liquidity: 720000n,
    tokenMintA: TOKEN_MINT_B,
    tokenMintB: TOKEN_MINT_A,
    tokenVaultA: POSITION_MINT,
    tokenVaultB: REWARD_VAULTS[0],
  });
  const whirlpoolTwoArgs = buildWhirlpoolArgs({
    tickCurrentIndex: 240,
    tickSpacing: 4,
    sqrtPrice: 1n << 64n,
    feeRate: 900,
    liquidity: 650000n,
    tokenMintA: TOKEN_MINT_A,
    tokenMintB: TOKEN_MINT_C,
    tokenVaultA: REWARD_VAULTS[1],
    tokenVaultB: REWARD_VAULTS[2],
  });

  return {
    name: 'A->B then A->B',
    whirlpoolOne: ORCA_WHIRLPOOL,
    whirlpoolTwo: ORCA_WHIRLPOOL_TWO,
    whirlpoolOneArgs,
    whirlpoolTwoArgs,
    tickArraysOneArgs: [
      buildCustomTickArrayArgs(0, [
        { offset: 30, liquidityNet: 6000n, liquidityGross: 6000n },
        { offset: 28, liquidityNet: -2000n, liquidityGross: 2000n },
        { offset: 24, liquidityNet: 3500n, liquidityGross: 3500n },
      ], ORCA_WHIRLPOOL),
      buildCustomTickArrayArgs(-352, [
        { offset: 84, liquidityNet: 8000n, liquidityGross: 8000n },
        { offset: 70, liquidityNet: -1500n, liquidityGross: 1500n },
      ], ORCA_WHIRLPOOL),
      buildCustomTickArrayArgs(-704, [], ORCA_WHIRLPOOL),
    ],
    tickArraysTwoArgs: [
      buildCustomTickArrayArgs(176, [
        { offset: 18, liquidityNet: 4000n, liquidityGross: 4000n },
        { offset: 11, liquidityNet: -1200n, liquidityGross: 1200n },
      ], ORCA_WHIRLPOOL_TWO),
      buildCustomTickArrayArgs(-176, [
        { offset: 87, liquidityNet: 2500n, liquidityGross: 2500n },
      ], ORCA_WHIRLPOOL_TWO),
      buildCustomTickArrayArgs(-528, [], ORCA_WHIRLPOOL_TWO),
    ],
    tokenInMint: TOKEN_MINT_B,
    tokenIntermediateMint: TOKEN_MINT_A,
    tokenOutMint: TOKEN_MINT_C,
    amountIn: '6800',
    slippageBps: '220',
    aToBOne: true,
    aToBTwo: true,
  };
}

function buildVectorTwo(): TwoHopVector {
  const whirlpoolOneArgs = buildWhirlpoolArgs({
    tickCurrentIndex: 792,
    tickSpacing: 3,
    sqrtPrice: 1n << 64n,
    feeRate: 1000,
    liquidity: 950000n,
    tokenMintA: TOKEN_MINT_A,
    tokenMintB: TOKEN_MINT_B,
    tokenVaultA: POSITION_MINT,
    tokenVaultB: REWARD_VAULTS[0],
  });
  const whirlpoolTwoArgs = buildWhirlpoolArgs({
    tickCurrentIndex: -150,
    tickSpacing: 5,
    sqrtPrice: 1n << 64n,
    feeRate: 700,
    liquidity: 830000n,
    tokenMintA: TOKEN_MINT_C,
    tokenMintB: TOKEN_MINT_A,
    tokenVaultA: REWARD_VAULTS[1],
    tokenVaultB: REWARD_VAULTS[2],
  });

  return {
    name: 'B->A then B->A',
    whirlpoolOne: ORCA_WHIRLPOOL,
    whirlpoolTwo: ORCA_WHIRLPOOL_TWO,
    whirlpoolOneArgs,
    whirlpoolTwoArgs,
    tickArraysOneArgs: [
      buildCustomTickArrayArgs(792, [
        { offset: 1, liquidityNet: 3000n, liquidityGross: 3000n },
        { offset: 5, liquidityNet: -1500n, liquidityGross: 1500n },
        { offset: 20, liquidityNet: 7000n, liquidityGross: 7000n },
      ], ORCA_WHIRLPOOL),
      buildCustomTickArrayArgs(1056, [
        { offset: 0, liquidityNet: -2500n, liquidityGross: 2500n },
        { offset: 11, liquidityNet: 4500n, liquidityGross: 4500n },
      ], ORCA_WHIRLPOOL),
      buildCustomTickArrayArgs(1320, [{ offset: 8, liquidityNet: 9000n, liquidityGross: 9000n }], ORCA_WHIRLPOOL),
    ],
    tickArraysTwoArgs: [
      buildCustomTickArrayArgs(-440, [
        { offset: 10, liquidityNet: 5000n, liquidityGross: 5000n },
        { offset: 6, liquidityNet: -2000n, liquidityGross: 2000n },
      ], ORCA_WHIRLPOOL_TWO),
      buildCustomTickArrayArgs(0, [
        { offset: 4, liquidityNet: 3500n, liquidityGross: 3500n },
      ], ORCA_WHIRLPOOL_TWO),
      buildCustomTickArrayArgs(440, [], ORCA_WHIRLPOOL_TWO),
    ],
    tokenInMint: TOKEN_MINT_B,
    tokenIntermediateMint: TOKEN_MINT_A,
    tokenOutMint: TOKEN_MINT_C,
    amountIn: '7300',
    slippageBps: '180',
    aToBOne: false,
    aToBTwo: false,
  };
}

async function getRuntimeQuote(vector: TwoHopVector, connection: StaticAccountConnection) {
  return runRuntimeView({
    protocolId: 'orca-whirlpool-mainnet',
    operationId: 'quote_two_hop_exact_in',
    input: {
      whirlpool_one: vector.whirlpoolOne,
      whirlpool_two: vector.whirlpoolTwo,
      token_in_mint: vector.tokenInMint,
      token_intermediate_mint: vector.tokenIntermediateMint,
      token_out_mint: vector.tokenOutMint,
      amount_in: vector.amountIn,
      slippage_bps: vector.slippageBps,
      unwrap_sol_output: false,
    },
    connection: connection as never,
    walletPublicKey: getTestWallet(),
  });
}

async function getPreparedWriteFromVector(
  vector: TwoHopVector,
  connection: StaticAccountConnection,
  tickArraysOne: string[],
  tickArraysTwo: string[],
) {
  const vaultsOne = expectedVaults(vector.whirlpoolOneArgs, vector.aToBOne);
  const vaultsTwo = expectedVaults(vector.whirlpoolTwoArgs, vector.aToBTwo);

  return prepareRuntimeInstruction({
    protocolId: 'orca-whirlpool-mainnet',
    operationId: 'two_hop_swap_v2',
    input: await buildTwoHopSwapV2WriteInput({
      whirlpoolOne: vector.whirlpoolOne,
      whirlpoolTwo: vector.whirlpoolTwo,
      amount: vector.amountIn,
      otherAmountThreshold: '1',
      aToBOne: vector.aToBOne,
      aToBTwo: vector.aToBTwo,
      sqrtPriceLimitOne: vector.aToBOne ? '4295048016' : '79226673515401279992447579055',
      sqrtPriceLimitTwo: vector.aToBTwo ? '4295048016' : '79226673515401279992447579055',
      tokenMintInput: vector.tokenInMint,
      tokenMintIntermediate: vector.tokenIntermediateMint,
      tokenMintOutput: vector.tokenOutMint,
      tokenProgramInput: TOKEN_PROGRAM,
      tokenProgramIntermediate: TOKEN_PROGRAM,
      tokenProgramOutput: TOKEN_PROGRAM,
      tokenVaultOneInput: String(vaultsOne.input),
      tokenVaultOneIntermediate: String(vaultsOne.output),
      tokenVaultTwoIntermediate: String(vaultsTwo.input),
      tokenVaultTwoOutput: String(vaultsTwo.output),
      tickArraysOne,
      tickArraysTwo,
    }),
    connection: connection as never,
    walletPublicKey: getTestWallet(),
  });
}

describe('Orca two-hop swap parity', () => {
  it('matches Orca low-level two_hop_swap_v2 encoding for an A->B / A->B route', async () => {
    const vector = buildVectorOne();
    const { connection, tickArraysOne, tickArraysTwo } = await buildTwoHopFixture(vector);
    const prepared = await getPreparedWriteFromVector(vector, connection, tickArraysOne, tickArraysTwo);
    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getTwoHopSwapV2Instruction({
      ...toCamelTwoHopSwapAccounts(prepared.accounts),
      amount: BigInt(String(prepared.args.amount)),
      otherAmountThreshold: BigInt(String(prepared.args.other_amount_threshold)),
      amountSpecifiedIsInput: Boolean(prepared.args.amount_specified_is_input),
      aToBOne: getPreparedBoolArg(prepared.args, 'a_to_bone', 'a_to_b_one'),
      aToBTwo: getPreparedBoolArg(prepared.args, 'a_to_btwo', 'a_to_b_two'),
      sqrtPriceLimitOne: BigInt(String(prepared.args.sqrt_price_limit_one)),
      sqrtPriceLimitTwo: BigInt(String(prepared.args.sqrt_price_limit_two)),
      remainingAccountsInfo: null,
    });

    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });

  it('derives all write accounts for a B->A / B->A route', async () => {
    const vector = buildVectorTwo();
    const { connection, tickArraysOne, tickArraysTwo } = await buildTwoHopFixture(vector);
    const prepared = await getPreparedWriteFromVector(vector, connection, tickArraysOne, tickArraysTwo);
    const oracleOne = (await getOracleAddress(address(vector.whirlpoolOne)))[0];
    const oracleTwo = (await getOracleAddress(address(vector.whirlpoolTwo)))[0];

    expect(prepared.accounts.token_owner_account_input).toBe(getWalletAta(vector.tokenInMint));
    expect(prepared.accounts.token_owner_account_output).toBe(getWalletAta(vector.tokenOutMint));
    expect(prepared.accounts.oracle_one).toBe(oracleOne);
    expect(prepared.accounts.oracle_two).toBe(oracleTwo);
    expect(prepared.accounts.tick_array_one0).toBe(tickArraysOne[0]);
    expect(prepared.accounts.tick_array_one1).toBe(tickArraysOne[1]);
    expect(prepared.accounts.tick_array_one2).toBe(tickArraysOne[2]);
    expect(prepared.accounts.tick_array_two0).toBe(tickArraysTwo[0]);
    expect(prepared.accounts.tick_array_two1).toBe(tickArraysTwo[1]);
    expect(prepared.accounts.tick_array_two2).toBe(tickArraysTwo[2]);
    expect(Object.keys(prepared.accounts)).toHaveLength(24);
  });

  it('matches chained Orca quotes for an A->B / A->B route', async () => {
    const vector = buildVectorOne();
    const { connection, tickArraysOne, tickArraysTwo } = await buildTwoHopFixture(vector);
    const quote = await getRuntimeQuote(vector, connection);
    const quoteOutput = quote.output as Record<string, unknown>;
    const legOne = swapQuoteByInputToken(
      BigInt(vector.amountIn),
      vector.aToBOne,
      Number(vector.slippageBps),
      toCoreWhirlpool(vector.whirlpoolOneArgs),
      undefined,
      vector.tickArraysOneArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const legTwo = swapQuoteByInputToken(
      legOne.tokenEstOut,
      vector.aToBTwo,
      Number(vector.slippageBps),
      toCoreWhirlpool(vector.whirlpoolTwoArgs),
      undefined,
      vector.tickArraysTwoArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    expect(quoteOutput.intermediate_amount).toBe(legOne.tokenEstOut.toString());
    expect(quoteOutput.estimated_out).toBe(legTwo.tokenEstOut.toString());
    expect(quoteOutput.minimum_out).toBe(legTwo.tokenMinOut.toString());
    expect(quoteOutput.tick_arrays_one).toEqual(tickArraysOne);
    expect(quoteOutput.tick_arrays_two).toEqual(tickArraysTwo);
  });

  it('matches chained Orca quotes for a B->A / B->A route', async () => {
    const vector = buildVectorTwo();
    const { connection, tickArraysOne, tickArraysTwo } = await buildTwoHopFixture(vector);
    const quote = await getRuntimeQuote(vector, connection);
    const quoteOutput = quote.output as Record<string, unknown>;
    const legOne = swapQuoteByInputToken(
      BigInt(vector.amountIn),
      vector.aToBOne,
      Number(vector.slippageBps),
      toCoreWhirlpool(vector.whirlpoolOneArgs),
      undefined,
      vector.tickArraysOneArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const legTwo = swapQuoteByInputToken(
      legOne.tokenEstOut,
      vector.aToBTwo,
      Number(vector.slippageBps),
      toCoreWhirlpool(vector.whirlpoolTwoArgs),
      undefined,
      vector.tickArraysTwoArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    expect(quoteOutput.intermediate_amount).toBe(legOne.tokenEstOut.toString());
    expect(quoteOutput.estimated_out).toBe(legTwo.tokenEstOut.toString());
    expect(quoteOutput.minimum_out).toBe(legTwo.tokenMinOut.toString());
    expect(quoteOutput.tick_arrays_one).toEqual(tickArraysOne);
    expect(quoteOutput.tick_arrays_two).toEqual(tickArraysTwo);
  });

  it('pipes a two-hop quote into two_hop_swap_v2 for an A->B / A->B route', async () => {
    const vector = buildVectorOne();
    const { connection } = await buildTwoHopFixture(vector);
    const quote = await getRuntimeQuote(vector, connection);
    const quoteOutput = quote.output as Record<string, unknown>;
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'two_hop_swap_v2',
      input: await buildTwoHopSwapV2WriteInput({
        whirlpoolOne: String(quoteOutput.whirlpool_one),
        whirlpoolTwo: String(quoteOutput.whirlpool_two),
        amount: String(quoteOutput.amount_in),
        otherAmountThreshold: String(quoteOutput.minimum_out),
        aToBOne: Boolean(quoteOutput.a_to_bone),
        aToBTwo: Boolean(quoteOutput.a_to_btwo),
        sqrtPriceLimitOne: String(quoteOutput.sqrt_price_limit_one),
        sqrtPriceLimitTwo: String(quoteOutput.sqrt_price_limit_two),
        tokenMintInput: String(quoteOutput.token_in_mint),
        tokenMintIntermediate: String(quoteOutput.token_intermediate_mint),
        tokenMintOutput: String(quoteOutput.token_out_mint),
        tokenProgramInput: String(quoteOutput.token_program_input),
        tokenProgramIntermediate: String(quoteOutput.token_program_intermediate),
        tokenProgramOutput: String(quoteOutput.token_program_output),
        tokenVaultOneInput: String(quoteOutput.token_vault_one_input),
        tokenVaultOneIntermediate: String(quoteOutput.token_vault_one_intermediate),
        tokenVaultTwoIntermediate: String(quoteOutput.token_vault_two_intermediate),
        tokenVaultTwoOutput: String(quoteOutput.token_vault_two_output),
        tickArraysOne: quoteOutput.tick_arrays_one as string[],
        tickArraysTwo: quoteOutput.tick_arrays_two as string[],
      }),
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(prepared.args.other_amount_threshold).toBe(String(quoteOutput.minimum_out));
    expect(prepared.accounts.tick_array_one0).toBe((quoteOutput.tick_arrays_one as string[])[0]);
    expect(prepared.accounts.tick_array_two2).toBe((quoteOutput.tick_arrays_two as string[])[2]);
  });

  it('pipes a two-hop quote into two_hop_swap_v2 for a B->A / B->A route', async () => {
    const vector = buildVectorTwo();
    const { connection } = await buildTwoHopFixture(vector);
    const quote = await getRuntimeQuote(vector, connection);
    const quoteOutput = quote.output as Record<string, unknown>;
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'two_hop_swap_v2',
      input: await buildTwoHopSwapV2WriteInput({
        whirlpoolOne: String(quoteOutput.whirlpool_one),
        whirlpoolTwo: String(quoteOutput.whirlpool_two),
        amount: String(quoteOutput.amount_in),
        otherAmountThreshold: String(quoteOutput.minimum_out),
        aToBOne: Boolean(quoteOutput.a_to_bone),
        aToBTwo: Boolean(quoteOutput.a_to_btwo),
        sqrtPriceLimitOne: String(quoteOutput.sqrt_price_limit_one),
        sqrtPriceLimitTwo: String(quoteOutput.sqrt_price_limit_two),
        tokenMintInput: String(quoteOutput.token_in_mint),
        tokenMintIntermediate: String(quoteOutput.token_intermediate_mint),
        tokenMintOutput: String(quoteOutput.token_out_mint),
        tokenProgramInput: String(quoteOutput.token_program_input),
        tokenProgramIntermediate: String(quoteOutput.token_program_intermediate),
        tokenProgramOutput: String(quoteOutput.token_program_output),
        tokenVaultOneInput: String(quoteOutput.token_vault_one_input),
        tokenVaultOneIntermediate: String(quoteOutput.token_vault_one_intermediate),
        tokenVaultTwoIntermediate: String(quoteOutput.token_vault_two_intermediate),
        tokenVaultTwoOutput: String(quoteOutput.token_vault_two_output),
        tickArraysOne: quoteOutput.tick_arrays_one as string[],
        tickArraysTwo: quoteOutput.tick_arrays_two as string[],
      }),
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(getPreparedBoolArg(prepared.args, 'a_to_bone', 'a_to_b_one')).toBe(false);
    expect(getPreparedBoolArg(prepared.args, 'a_to_btwo', 'a_to_b_two')).toBe(false);
    expect(prepared.accounts.token_vault_one_input).toBe(String(quoteOutput.token_vault_one_input));
    expect(prepared.accounts.token_vault_two_output).toBe(String(quoteOutput.token_vault_two_output));
  });
});
