import { describe, expect, it } from 'vitest';
import { getSwapV2Instruction } from '@orca-so/whirlpools-client';
import { swapQuoteByInputToken, swapQuoteByOutputToken } from '@orca-so/whirlpools-core';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import {
  buildCustomTickArrayArgs,
  buildWhirlpoolArgs,
  ORCA_WHIRLPOOL,
  toCoreTickArray,
  toCoreWhirlpool,
} from './fixtures.js';
import {
  buildQuoteFixture,
  buildSwapExactInWriteInput,
  getTestWallet,
  toCamelSwapAccounts,
} from './helpers.js';

describe('Orca quote to swap integration', () => {
  it('pipes quote_exact_in into swap_exact_in for A->B', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 120,
      tickSpacing: 4,
      sqrtPrice: 1n << 64n,
      feeRate: 1800,
      liquidity: 720000n,
    });
    const tickArrayArgs = [
      buildCustomTickArrayArgs(0, [
        { offset: 30, liquidityNet: 6000n, liquidityGross: 6000n },
        { offset: 28, liquidityNet: -2000n, liquidityGross: 2000n },
        { offset: 24, liquidityNet: 3500n, liquidityGross: 3500n },
      ]),
      buildCustomTickArrayArgs(-352, [
        { offset: 84, liquidityNet: 8000n, liquidityGross: 8000n },
        { offset: 70, liquidityNet: -1500n, liquidityGross: 1500n },
      ]),
      buildCustomTickArrayArgs(-704, []),
    ];
    const fixture = await buildQuoteFixture({ whirlpoolArgs, tickArrayArgs, aToB: true });

    const quote = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintA,
        token_out_mint: whirlpoolArgs.tokenMintB,
        amount_in: '6800',
        slippage_bps: '220',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const quoteOutput = quote.output as Record<string, string>;
    const coreQuote = swapQuoteByInputToken(
      6800n,
      true,
      220,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    expect(quoteOutput.estimated_out).toBe(coreQuote.tokenEstOut.toString());

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'swap_exact_in',
      input: await buildSwapExactInWriteInput({
        amount: quoteOutput.amount_in,
        otherAmountThreshold: quoteOutput.minimum_out,
        sqrtPriceLimit: String(quote.derived.sqrt_price_limit),
        amountSpecifiedIsInput: true,
        aToB: true,
        whirlpoolArgs,
        tickArrays: quote.derived.tick_arrays as string[],
      }),
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getSwapV2Instruction({
      ...toCamelSwapAccounts(prepared.accounts),
      amount: BigInt(String(prepared.args.amount)),
      otherAmountThreshold: BigInt(String(prepared.args.other_amount_threshold)),
      sqrtPriceLimit: BigInt(String(prepared.args.sqrt_price_limit)),
      amountSpecifiedIsInput: Boolean(prepared.args.amount_specified_is_input),
      aToB: Boolean(prepared.args.a_to_b),
      remainingAccountsInfo: null,
    });

    expect(prepared.args.other_amount_threshold).toBe(quoteOutput.minimum_out);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });

  it('pipes quote_exact_in into swap_exact_in for B->A', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 792,
      tickSpacing: 3,
      sqrtPrice: 1n << 64n,
      feeRate: 1000,
      liquidity: 950000n,
    });
    const tickArrayArgs = [
      buildCustomTickArrayArgs(792, [
        { offset: 1, liquidityNet: 3000n, liquidityGross: 3000n },
        { offset: 5, liquidityNet: -1500n, liquidityGross: 1500n },
        { offset: 20, liquidityNet: 7000n, liquidityGross: 7000n },
      ]),
      buildCustomTickArrayArgs(1056, [
        { offset: 0, liquidityNet: -2500n, liquidityGross: 2500n },
        { offset: 11, liquidityNet: 4500n, liquidityGross: 4500n },
      ]),
      buildCustomTickArrayArgs(1320, [{ offset: 8, liquidityNet: 9000n, liquidityGross: 9000n }]),
    ];
    const fixture = await buildQuoteFixture({ whirlpoolArgs, tickArrayArgs, aToB: false });

    const quote = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintB,
        token_out_mint: whirlpoolArgs.tokenMintA,
        amount_in: '7300',
        slippage_bps: '180',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const quoteOutput = quote.output as Record<string, string>;
    const coreQuote = swapQuoteByInputToken(
      7300n,
      false,
      180,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    expect(quoteOutput.estimated_out).toBe(coreQuote.tokenEstOut.toString());

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'swap_exact_in',
      input: await buildSwapExactInWriteInput({
        amount: quoteOutput.amount_in,
        otherAmountThreshold: quoteOutput.minimum_out,
        sqrtPriceLimit: String(quote.derived.sqrt_price_limit),
        amountSpecifiedIsInput: true,
        aToB: false,
        whirlpoolArgs,
        tickArrays: quote.derived.tick_arrays as string[],
      }),
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getSwapV2Instruction({
      ...toCamelSwapAccounts(prepared.accounts),
      amount: BigInt(String(prepared.args.amount)),
      otherAmountThreshold: BigInt(String(prepared.args.other_amount_threshold)),
      sqrtPriceLimit: BigInt(String(prepared.args.sqrt_price_limit)),
      amountSpecifiedIsInput: Boolean(prepared.args.amount_specified_is_input),
      aToB: Boolean(prepared.args.a_to_b),
      remainingAccountsInfo: null,
    });

    expect(prepared.args.other_amount_threshold).toBe(quoteOutput.minimum_out);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });

  it('pipes quote_exact_out into swap_exact_in with amount_specified_is_input=false', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      protocolFeeRate: 3000,
      liquidity: 265000n,
    });
    const tickArrayArgs = [
      buildCustomTickArrayArgs(0, Array.from({ length: 88 }, (_, offset) => ({
        offset,
        liquidityNet: -1000n,
        liquidityGross: 1000n,
      }))),
      buildCustomTickArrayArgs(176, Array.from({ length: 88 }, (_, offset) => ({
        offset,
        liquidityNet: -1000n,
        liquidityGross: 1000n,
      }))),
      buildCustomTickArrayArgs(352, Array.from({ length: 88 }, (_, offset) => ({
        offset,
        liquidityNet: -1000n,
        liquidityGross: 1000n,
      }))),
    ];
    const fixture = await buildQuoteFixture({ whirlpoolArgs, tickArrayArgs, aToB: false });

    const quote = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_out',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintB,
        token_out_mint: whirlpoolArgs.tokenMintA,
        amount_out: '500',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const quoteOutput = quote.output as Record<string, string>;
    const coreQuote = swapQuoteByOutputToken(
      500n,
      false,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      [
        buildCustomTickArrayArgs(-352, Array.from({ length: 88 }, (_, offset) => ({
          offset,
          liquidityNet: 1000n,
          liquidityGross: 1000n,
        }))),
        buildCustomTickArrayArgs(-176, Array.from({ length: 88 }, (_, offset) => ({
          offset,
          liquidityNet: 1000n,
          liquidityGross: 1000n,
        }))),
        ...tickArrayArgs,
      ].map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    expect(quoteOutput.estimated_in).toBe(coreQuote.tokenEstIn.toString());

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'swap_exact_in',
      input: await buildSwapExactInWriteInput({
        amount: quoteOutput.amount_out,
        otherAmountThreshold: quoteOutput.maximum_in,
        sqrtPriceLimit: String(quote.derived.sqrt_price_limit),
        amountSpecifiedIsInput: false,
        aToB: false,
        whirlpoolArgs,
        tickArrays: quote.derived.tick_arrays as string[],
      }),
      connection: fixture.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getSwapV2Instruction({
      ...toCamelSwapAccounts(prepared.accounts),
      amount: BigInt(String(prepared.args.amount)),
      otherAmountThreshold: BigInt(String(prepared.args.other_amount_threshold)),
      sqrtPriceLimit: BigInt(String(prepared.args.sqrt_price_limit)),
      amountSpecifiedIsInput: Boolean(prepared.args.amount_specified_is_input),
      aToB: Boolean(prepared.args.a_to_b),
      remainingAccountsInfo: null,
    });

    expect(prepared.args.amount_specified_is_input).toBe(false);
    expect(prepared.args.amount).toBe(quoteOutput.amount_out);
    expect(prepared.args.other_amount_threshold).toBe(quoteOutput.maximum_in);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });
});
