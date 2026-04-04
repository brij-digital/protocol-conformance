import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { buyQuoteInput, sellBaseInput } from '@pump-fun/pump-swap-sdk';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { getTestWallet } from '../../src/support/runtime.js';
import {
  buildPumpAmmConnection,
  PUMP_AMM_FIXTURE,
  PUMP_AMM_PROGRAM_ID,
  PUMP_AMM_PROTOCOL_ID,
  PUMP_AMM_SDK,
} from '../pump-fixtures/pump-amm.js';
import { executeTransform, instructionPubkeys, lastInstruction, loadRuntimePack } from './pump-test-helpers.js';

const runtimePack = loadRuntimePack('../../../ec-ai-wallet/public/idl/pump_amm.runtime.json');

describe('Pump AMM parity', () => {
  it('matches SDK instruction encoding and remaining accounts for buy', async () => {
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const quoteAmountIn = new BN('1500000');
    const slippagePercent = 2;
    const quote = buyQuoteInput({
      quote: quoteAmountIn,
      slippage: slippagePercent,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const prepared = await prepareRuntimeInstruction({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      operationId: 'buy',
      input: {
        pool: PUMP_AMM_FIXTURE.poolKey.toBase58(),
        global_config: PUMP_AMM_FIXTURE.globalConfigPda.toBase58(),
        base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
        quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
        user_base_token_account: PUMP_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_quote_token_account: PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        pool_base_token_account: PUMP_AMM_FIXTURE.poolBaseTokenAccount.toBase58(),
        pool_quote_token_account: PUMP_AMM_FIXTURE.poolQuoteTokenAccount.toBase58(),
        protocol_fee_recipient: PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58(),
        base_token_program: TOKEN_PROGRAM_ID.toBase58(),
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
        coin_creator_vault_authority: PUMP_AMM_FIXTURE.coinCreatorVaultAuthority.toBase58(),
        base_amount_out: quote.base.toString(),
        max_quote_amount_in: quote.maxQuote.toString(),
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const sdkInstruction = lastInstruction(await PUMP_AMM_SDK.buyQuoteInput(sdkState, quoteAmountIn, slippagePercent));

    expect(prepared.accounts.user).toBe(PUMP_AMM_FIXTURE.wallet.toBase58());
    expect(prepared.accounts.protocol_fee_recipient_token_account).toBe(
      PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58(),
    );
    expect(prepared.accounts.coin_creator_vault_ata).toBe(PUMP_AMM_FIXTURE.coinCreatorVaultAta.toBase58());
    expect(runtimePreview.programId).toBe(sdkInstruction.programId.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(instructionPubkeys(sdkInstruction).slice(0, runtimePreview.keys.length));
    expect(prepared.remainingAccounts.map((entry) => entry.pubkey)).toEqual(
      instructionPubkeys(sdkInstruction).slice(runtimePreview.keys.length),
    );
  });

  it('matches SDK instruction encoding and remaining accounts for sell', async () => {
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const baseAmountIn = new BN('400000');
    const slippagePercent = 2;
    const quote = sellBaseInput({
      base: baseAmountIn,
      slippage: slippagePercent,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const prepared = await prepareRuntimeInstruction({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      operationId: 'sell',
      input: {
        pool: PUMP_AMM_FIXTURE.poolKey.toBase58(),
        global_config: PUMP_AMM_FIXTURE.globalConfigPda.toBase58(),
        base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
        quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
        user_base_token_account: PUMP_AMM_FIXTURE.userBaseTokenAccount.toBase58(),
        user_quote_token_account: PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
        pool_base_token_account: PUMP_AMM_FIXTURE.poolBaseTokenAccount.toBase58(),
        pool_quote_token_account: PUMP_AMM_FIXTURE.poolQuoteTokenAccount.toBase58(),
        protocol_fee_recipient: PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58(),
        base_token_program: TOKEN_PROGRAM_ID.toBase58(),
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
        coin_creator_vault_authority: PUMP_AMM_FIXTURE.coinCreatorVaultAuthority.toBase58(),
        base_amount_in: baseAmountIn.toString(),
        min_quote_amount_out: quote.minQuote.toString(),
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const sdkInstruction = lastInstruction(await PUMP_AMM_SDK.sellBaseInput(sdkState, baseAmountIn, slippagePercent));

    expect(prepared.accounts.user).toBe(PUMP_AMM_FIXTURE.wallet.toBase58());
    expect(prepared.accounts.protocol_fee_recipient_token_account).toBe(
      PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58(),
    );
    expect(runtimePreview.programId).toBe(sdkInstruction.programId.toBase58());
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(sdkInstruction.data);
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(instructionPubkeys(sdkInstruction).slice(0, runtimePreview.keys.length));
    expect(prepared.remainingAccounts.map((entry) => entry.pubkey)).toEqual(
      instructionPubkeys(sdkInstruction).slice(runtimePreview.keys.length),
    );
  });

  it('matches SDK quote math and PDA derivation for preview_buy', async () => {
    const connection = await buildPumpAmmConnection();
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const quoteAmountIn = new BN('1500000');
    const slippagePercent = 2;
    const sdkQuote = buyQuoteInput({
      quote: quoteAmountIn,
      slippage: slippagePercent,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const view = await runRuntimeView({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      operationId: 'preview_buy',
      input: {
        base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
        quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
        pool: PUMP_AMM_FIXTURE.poolKey.toBase58(),
        quote_amount_in: quoteAmountIn.toString(),
        track_volume: false,
        slippage_bps: 200,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(view.derived.global_config).toBe(PUMP_AMM_FIXTURE.globalConfigPda.toBase58());
    expect(view.derived.user_base_token_account).toBe(PUMP_AMM_FIXTURE.userBaseTokenAccount.toBase58());
    expect(view.derived.user_quote_token_account).toBe(PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58());
    expect(view.derived.coin_creator_vault_authority).toBe(PUMP_AMM_FIXTURE.coinCreatorVaultAuthority.toBase58());
    expect(view.derived.protocol_fee_recipient).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58());
    expect(view.derived.base_amount_out).toBe(sdkQuote.base.toString());
    expect(view.derived.max_quote_amount_in).toBe(sdkQuote.maxQuote.toString());
  });

  it('matches SDK quote math and PDA derivation for preview_sell', async () => {
    const connection = await buildPumpAmmConnection();
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const baseAmountIn = new BN('400000');
    const sdkQuote = sellBaseInput({
      base: baseAmountIn,
      slippage: 0,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const view = await runRuntimeView({
      protocolId: PUMP_AMM_PROTOCOL_ID,
      operationId: 'preview_sell',
      input: {
        base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
        quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
        pool: PUMP_AMM_FIXTURE.poolKey.toBase58(),
        base_amount_in: baseAmountIn.toString(),
        min_quote_amount_out: '0',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(view.derived.global_config).toBe(PUMP_AMM_FIXTURE.globalConfigPda.toBase58());
    expect(view.derived.user_base_token_account).toBe(PUMP_AMM_FIXTURE.userBaseTokenAccount.toBase58());
    expect(view.derived.user_quote_token_account).toBe(PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58());
    expect(view.derived.protocol_fee_recipient).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58());
    expect(view.derived.protocol_fee_recipient_token_account).toBe(
      PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58(),
    );
    expect(view.derived.estimated_quote_amount_out).toBe(sdkQuote.uiQuote.toString());
  });

  it('computes preview_buy__transform consistently with the SDK quote path', async () => {
    const quoteAmountIn = new BN('1500000');
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const sdkQuote = buyQuoteInput({
      quote: quoteAmountIn,
      slippage: 2,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const derived = await executeTransform({
      runtimePack,
      transformName: 'preview_buy__transform',
      programId: PUMP_AMM_PROGRAM_ID,
      bindings: {
        input: {
          quote_amount_in: quoteAmountIn.toString(),
          slippage_bps: 200,
        },
        global_config_data: {
          protocol_fee_recipients: [PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58()],
          lp_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.lpFeeBasisPoints.toString(),
          protocol_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.protocolFeeBasisPoints.toString(),
          coin_creator_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.coinCreatorFeeBasisPoints.toString(),
        },
        fee_config_data: {
          flat_fees: {
            lp_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.lpFeeBps.toString(),
            protocol_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.protocolFeeBps.toString(),
            creator_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.creatorFeeBps.toString(),
          },
          fee_tiers: PUMP_AMM_FIXTURE.feeConfig.feeTiers.map((entry) => ({
            market_cap_lamports_threshold: entry.marketCapLamportsThreshold.toString(),
            fees: {
              lp_fee_bps: entry.fees.lpFeeBps.toString(),
              protocol_fee_bps: entry.fees.protocolFeeBps.toString(),
              creator_fee_bps: entry.fees.creatorFeeBps.toString(),
            },
          })),
        },
        pool_data: {
          base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
          quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
          coin_creator: PUMP_AMM_FIXTURE.pool.coinCreator.toBase58(),
          creator: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
          is_cashback_coin: false,
        },
        base_mint_data: {
          supply: PUMP_AMM_FIXTURE.sdkState().baseMintAccount.supply.toString(),
        },
        pool_base_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolBaseAmount.toString(),
        },
        pool_quote_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolQuoteAmount.toString(),
        },
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
        pump_pool_authority: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
        pool_v2: PUMP_AMM_FIXTURE.poolV2.toBase58(),
        user_volume_accumulator_wsol_ata: PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
      },
    });

    expect(derived.total_fee_bps).toBe('190');
    expect(derived.base_amount_out).toBe(sdkQuote.base.toString());
    expect(derived.max_quote_amount_in).toBe(sdkQuote.maxQuote.toString());
    expect(derived.protocol_fee_recipient_token_account).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58());
  });

  it('computes buy__transform consistently with the SDK quote path', async () => {
    const derived = await executeTransform({
      runtimePack,
      transformName: 'buy__transform',
      programId: PUMP_AMM_PROGRAM_ID,
      bindings: {
        input: {
          quote_amount_in: '1500000',
          slippage_bps: 200,
        },
        global_config_data: {
          protocol_fee_recipients: [PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58()],
          lp_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.lpFeeBasisPoints.toString(),
          protocol_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.protocolFeeBasisPoints.toString(),
          coin_creator_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.coinCreatorFeeBasisPoints.toString(),
        },
        fee_config_data: {
          flat_fees: {
            lp_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.lpFeeBps.toString(),
            protocol_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.protocolFeeBps.toString(),
            creator_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.creatorFeeBps.toString(),
          },
          fee_tiers: PUMP_AMM_FIXTURE.feeConfig.feeTiers.map((entry) => ({
            market_cap_lamports_threshold: entry.marketCapLamportsThreshold.toString(),
            fees: {
              lp_fee_bps: entry.fees.lpFeeBps.toString(),
              protocol_fee_bps: entry.fees.protocolFeeBps.toString(),
              creator_fee_bps: entry.fees.creatorFeeBps.toString(),
            },
          })),
        },
        pool_data: {
          base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
          quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
          coin_creator: PUMP_AMM_FIXTURE.pool.coinCreator.toBase58(),
          creator: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
          is_cashback_coin: false,
        },
        base_mint_data: {
          supply: PUMP_AMM_FIXTURE.sdkState().baseMintAccount.supply.toString(),
        },
        pool_base_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolBaseAmount.toString(),
        },
        pool_quote_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolQuoteAmount.toString(),
        },
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
        pump_pool_authority: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
        pool_v2: PUMP_AMM_FIXTURE.poolV2.toBase58(),
        user_volume_accumulator_wsol_ata: PUMP_AMM_FIXTURE.userQuoteTokenAccount.toBase58(),
      },
    });

    expect(derived.protocol_fee_recipient).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58());
    expect(derived.protocol_fee_recipient_token_account).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58());
    expect(derived.remaining_accounts).toEqual([
      {
        pubkey: PUMP_AMM_FIXTURE.poolV2.toBase58(),
        isSigner: false,
        isWritable: false,
      },
    ]);
  });

  it('computes preview_sell__transform consistently with the SDK quote path', async () => {
    const sdkState = PUMP_AMM_FIXTURE.sdkState();
    const baseAmountIn = new BN('400000');
    const sdkQuote = sellBaseInput({
      base: baseAmountIn,
      slippage: 0,
      baseReserve: sdkState.poolBaseAmount,
      quoteReserve: sdkState.poolQuoteAmount,
      globalConfig: sdkState.globalConfig,
      baseMintAccount: sdkState.baseMintAccount,
      baseMint: sdkState.baseMint,
      coinCreator: sdkState.pool.coinCreator,
      creator: sdkState.pool.creator,
      feeConfig: sdkState.feeConfig,
    });

    const derived = await executeTransform({
      runtimePack,
      transformName: 'preview_sell__transform',
      programId: PUMP_AMM_PROGRAM_ID,
      bindings: {
        input: {
          base_amount_in: baseAmountIn.toString(),
        },
        global_config_data: {
          protocol_fee_recipients: [PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58()],
          lp_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.lpFeeBasisPoints.toString(),
          protocol_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.protocolFeeBasisPoints.toString(),
          coin_creator_fee_basis_points: PUMP_AMM_FIXTURE.globalConfig.coinCreatorFeeBasisPoints.toString(),
        },
        fee_config_data: {
          flat_fees: {
            lp_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.lpFeeBps.toString(),
            protocol_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.protocolFeeBps.toString(),
            creator_fee_bps: PUMP_AMM_FIXTURE.feeConfig.flatFees.creatorFeeBps.toString(),
          },
          fee_tiers: PUMP_AMM_FIXTURE.feeConfig.feeTiers.map((entry) => ({
            market_cap_lamports_threshold: entry.marketCapLamportsThreshold.toString(),
            fees: {
              lp_fee_bps: entry.fees.lpFeeBps.toString(),
              protocol_fee_bps: entry.fees.protocolFeeBps.toString(),
              creator_fee_bps: entry.fees.creatorFeeBps.toString(),
            },
          })),
        },
        pool_data: {
          base_mint: PUMP_AMM_FIXTURE.baseMint.toBase58(),
          quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
          coin_creator: PUMP_AMM_FIXTURE.pool.coinCreator.toBase58(),
          creator: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
        },
        base_mint_data: {
          supply: PUMP_AMM_FIXTURE.sdkState().baseMintAccount.supply.toString(),
        },
        pool_base_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolBaseAmount.toString(),
        },
        pool_quote_reserve_data: {
          amount: PUMP_AMM_FIXTURE.poolQuoteAmount.toString(),
        },
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
        pump_pool_authority: PUMP_AMM_FIXTURE.pool.creator.toBase58(),
      },
    });

    expect(derived.protocol_fee_recipient).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58());
    expect(derived.protocol_fee_recipient_token_account).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58());
    expect(derived.estimated_quote_amount_out).toBe(sdkQuote.uiQuote.toString());
  });

  it('computes sell__transform protocol fee recipient accounts', async () => {
    const derived = await executeTransform({
      runtimePack,
      transformName: 'sell__transform',
      programId: PUMP_AMM_PROGRAM_ID,
      bindings: {
        global_config_data: {
          protocol_fee_recipients: [PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58()],
        },
        pool_data: {
          quote_mint: PUMP_AMM_FIXTURE.quoteMint.toBase58(),
        },
        quote_token_program: TOKEN_PROGRAM_ID.toBase58(),
      },
    });

    expect(derived.protocol_fee_recipient).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipient.toBase58());
    expect(derived.protocol_fee_recipient_token_account).toBe(PUMP_AMM_FIXTURE.protocolFeeRecipientTokenAccount.toBase58());
  });
});
