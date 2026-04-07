import BN from 'bn.js';
import { none } from '@solana/kit';
import type { Address } from '@solana/kit';
import {
  flashBorrowReserveLiquidity,
  liquidateObligationAndRedeemReserveCollateral,
} from '@kamino-finance/klend-sdk';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { asAddress, instructionDataAsBuffer } from './address.js';
import {
  buildKaminoConnection,
  KAMINO_FIXTURE,
  KAMINO_PROGRAM_ID,
  KAMINO_PROTOCOL_ID,
} from './fixtures.js';

function sdkSigner(address: string) {
  return { address } as never;
}

function sdkAddress(value: string): Address {
  return asAddress(value);
}

function comparableSdkAccounts(
  accounts: Array<{ address: string; role: number }>,
): Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }> {
  return accounts.map((entry) => ({
    pubkey: entry.address,
    isSigner: entry.role === 2 || entry.role === 3,
    isWritable: entry.role === 1 || entry.role === 3,
  }));
}

describe('Kamino advanced actions + views', () => {
  it('matches SDK instruction encoding for liquidate', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'liquidate',
      input: {
        liquidator: KAMINO_FIXTURE.owner.toBase58(),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        lending_market_authority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        repay_reserve: KAMINO_FIXTURE.reserve.toBase58(),
        repay_reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        repay_reserve_liquidity_supply: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        withdraw_reserve: KAMINO_FIXTURE.reserve.toBase58(),
        withdraw_reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        withdraw_reserve_collateral_mint: KAMINO_FIXTURE.reserveCollateralMint.toBase58(),
        withdraw_reserve_collateral_supply: KAMINO_FIXTURE.reserveCollateralSupply.toBase58(),
        withdraw_reserve_liquidity_supply: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        withdraw_reserve_liquidity_fee_receiver: KAMINO_FIXTURE.reserveFeeVault.toBase58(),
        user_source_liquidity: KAMINO_FIXTURE.userSourceLiquidity.toBase58(),
        user_destination_collateral: KAMINO_FIXTURE.userDestinationCollateral.toBase58(),
        user_destination_liquidity: KAMINO_FIXTURE.userDestinationLiquidity.toBase58(),
        collateral_token_program: KAMINO_FIXTURE.collateralTokenProgram.toBase58(),
        repay_liquidity_token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        withdraw_liquidity_token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        liquidity_amount: '250000',
        min_acceptable_received_liquidity_amount: '200000',
        max_allowed_ltv_override_percent: '0',
      },
      connection: {} as never,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });
    const sdkInstruction = liquidateObligationAndRedeemReserveCollateral(
      {
        liquidityAmount: new BN(prepared.args.liquidity_amount as string),
        minAcceptableReceivedLiquidityAmount: new BN(
          prepared.args.min_acceptable_received_liquidity_amount as string,
        ),
        maxAllowedLtvOverridePercent: new BN(prepared.args.max_allowed_ltv_override_percent as string),
      },
      {
        liquidator: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: sdkAddress(KAMINO_FIXTURE.obligation.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        lendingMarketAuthority: sdkAddress(KAMINO_FIXTURE.lendingMarketAuthority.toBase58()),
        repayReserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        repayReserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        repayReserveLiquiditySupply: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        withdrawReserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        withdrawReserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        withdrawReserveCollateralMint: sdkAddress(KAMINO_FIXTURE.reserveCollateralMint.toBase58()),
        withdrawReserveCollateralSupply: sdkAddress(KAMINO_FIXTURE.reserveCollateralSupply.toBase58()),
        withdrawReserveLiquiditySupply: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        withdrawReserveLiquidityFeeReceiver: sdkAddress(KAMINO_FIXTURE.reserveFeeVault.toBase58()),
        userSourceLiquidity: sdkAddress(KAMINO_FIXTURE.userSourceLiquidity.toBase58()),
        userDestinationCollateral: sdkAddress(KAMINO_FIXTURE.userDestinationCollateral.toBase58()),
        userDestinationLiquidity: sdkAddress(KAMINO_FIXTURE.userDestinationLiquidity.toBase58()),
        collateralTokenProgram: sdkAddress(KAMINO_FIXTURE.collateralTokenProgram.toBase58()),
        repayLiquidityTokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        withdrawLiquidityTokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        instructionSysvarAccount: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(sdkInstruction.accounts as never));
  });

  it('matches SDK instruction encoding for flash borrow', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'flash_loan',
      input: {
        user_transfer_authority: KAMINO_FIXTURE.owner.toBase58(),
        lending_market_authority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        reserve: KAMINO_FIXTURE.reserve.toBase58(),
        reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        reserve_source_liquidity: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        user_destination_liquidity: KAMINO_FIXTURE.userDestinationLiquidity.toBase58(),
        reserve_liquidity_fee_receiver: KAMINO_FIXTURE.reserveFeeVault.toBase58(),
        token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        liquidity_amount: '500000',
      },
      connection: {} as never,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });
    const sdkInstruction = flashBorrowReserveLiquidity(
      { liquidityAmount: new BN(prepared.args.liquidity_amount as string) },
      {
        userTransferAuthority: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        lendingMarketAuthority: sdkAddress(KAMINO_FIXTURE.lendingMarketAuthority.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        reserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        reserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        reserveSourceLiquidity: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        userDestinationLiquidity: sdkAddress(KAMINO_FIXTURE.userDestinationLiquidity.toBase58()),
        reserveLiquidityFeeReceiver: sdkAddress(KAMINO_FIXTURE.reserveFeeVault.toBase58()),
        referrerTokenState: none(),
        referrerAccount: none(),
        sysvarInfo: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
        tokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    const expectedKeys = comparableSdkAccounts(sdkInstruction.accounts as never);

    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(expectedKeys.map((entry) => entry.pubkey));
    expect(runtimePreview.keys.slice(0, 8)).toEqual(expectedKeys.slice(0, 8));
    expect(runtimePreview.keys[8]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: true,
    });
    expect(runtimePreview.keys[9]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: true,
    });
    expect(expectedKeys[8]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
    expect(expectedKeys[9]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
    expect(runtimePreview.keys.slice(10)).toEqual(expectedKeys.slice(10));
  });

  it('returns obligation health fields from the fixture obligation account', async () => {
    const view = await runRuntimeView({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'obligation_health',
      input: {
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
      },
      connection: (await buildKaminoConnection()) as never,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });

    expect(view.output).toMatchObject({
      owner: KAMINO_FIXTURE.owner.toBase58(),
      lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
      deposited_value_sf: KAMINO_FIXTURE.obligationAccount.depositedValueSf.toString(),
      borrowed_assets_market_value_sf: KAMINO_FIXTURE.obligationAccount.borrowedAssetsMarketValueSf.toString(),
      allowed_borrow_value_sf: KAMINO_FIXTURE.obligationAccount.allowedBorrowValueSf.toString(),
      unhealthy_borrow_value_sf: KAMINO_FIXTURE.obligationAccount.unhealthyBorrowValueSf.toString(),
      has_debt: 1,
    });
  });

  it('returns reserve info fields from the fixture reserve account', async () => {
    const view = await runRuntimeView({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'reserve_info',
      input: {
        reserve: KAMINO_FIXTURE.reserve.toBase58(),
      },
      connection: (await buildKaminoConnection()) as never,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });

    expect(view.output).toMatchObject({
      lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
      liquidity: {
        mint_pubkey: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        supply_vault: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        fee_vault: KAMINO_FIXTURE.reserveFeeVault.toBase58(),
        available_amount: KAMINO_FIXTURE.reserveAccount.liquidity.availableAmount.toString(),
        borrowed_amount_sf: KAMINO_FIXTURE.reserveAccount.liquidity.borrowedAmountSf.toString(),
        mint_decimals: KAMINO_FIXTURE.reserveAccount.liquidity.mintDecimals.toString(),
      },
      collateral: {
        mint_pubkey: KAMINO_FIXTURE.reserveCollateralMint.toBase58(),
        supply_vault: KAMINO_FIXTURE.reserveCollateralSupply.toBase58(),
      },
      config: {
        loan_to_value_pct: KAMINO_FIXTURE.reserveAccount.config.loanToValuePct,
        liquidation_threshold_pct: KAMINO_FIXTURE.reserveAccount.config.liquidationThresholdPct,
        min_liquidation_bonus_bps: KAMINO_FIXTURE.reserveAccount.config.minLiquidationBonusBps,
        max_liquidation_bonus_bps: KAMINO_FIXTURE.reserveAccount.config.maxLiquidationBonusBps,
      },
    });
  });
});
