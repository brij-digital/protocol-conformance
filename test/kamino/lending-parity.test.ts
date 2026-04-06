import BN from 'bn.js';
import { none } from '@solana/kit';
import type { Address } from '@solana/kit';
import {
  PROGRAM_ID,
  Obligation,
  borrowObligationLiquidity,
  depositReserveLiquidityAndObligationCollateral,
  repayObligationLiquidity,
  withdrawObligationCollateral,
} from '@kamino-finance/klend-sdk';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { asAddress, instructionDataAsBuffer } from './address.js';
import { KAMINO_FIXTURE, KAMINO_PROGRAM_ID, KAMINO_PROTOCOL_ID } from './fixtures.js';

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

describe('Kamino lending parity', () => {
  it('matches SDK instruction encoding for deposit', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'deposit',
      input: {
        owner: KAMINO_FIXTURE.owner.toBase58(),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        lending_market_authority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        reserve: KAMINO_FIXTURE.reserve.toBase58(),
        reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        reserve_liquidity_supply: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        reserve_collateral_mint: KAMINO_FIXTURE.reserveCollateralMint.toBase58(),
        reserve_destination_deposit_collateral: KAMINO_FIXTURE.reserveCollateralSupply.toBase58(),
        user_source_liquidity: KAMINO_FIXTURE.userSourceLiquidity.toBase58(),
        collateral_token_program: KAMINO_FIXTURE.collateralTokenProgram.toBase58(),
        liquidity_token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        liquidity_amount: '1250000',
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
    const sdkInstruction = depositReserveLiquidityAndObligationCollateral(
      { liquidityAmount: new BN(prepared.args.liquidity_amount as string) },
      {
        owner: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: sdkAddress(KAMINO_FIXTURE.obligation.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        lendingMarketAuthority: sdkAddress(KAMINO_FIXTURE.lendingMarketAuthority.toBase58()),
        reserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        reserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        reserveLiquiditySupply: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        reserveCollateralMint: sdkAddress(KAMINO_FIXTURE.reserveCollateralMint.toBase58()),
        reserveDestinationDepositCollateral: sdkAddress(KAMINO_FIXTURE.reserveCollateralSupply.toBase58()),
        userSourceLiquidity: sdkAddress(KAMINO_FIXTURE.userSourceLiquidity.toBase58()),
        placeholderUserDestinationCollateral: none(),
        collateralTokenProgram: sdkAddress(KAMINO_FIXTURE.collateralTokenProgram.toBase58()),
        liquidityTokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        instructionSysvarAccount: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(sdkInstruction.accounts as never));
  });

  it('matches SDK instruction encoding for borrow', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'borrow',
      input: {
        owner: KAMINO_FIXTURE.owner.toBase58(),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        lending_market_authority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        borrow_reserve: KAMINO_FIXTURE.reserve.toBase58(),
        borrow_reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        reserve_source_liquidity: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        borrow_reserve_liquidity_fee_receiver: KAMINO_FIXTURE.reserveFeeVault.toBase58(),
        user_destination_liquidity: KAMINO_FIXTURE.userDestinationLiquidity.toBase58(),
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
    const sdkInstruction = borrowObligationLiquidity(
      { liquidityAmount: new BN(prepared.args.liquidity_amount as string) },
      {
        owner: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: sdkAddress(KAMINO_FIXTURE.obligation.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        lendingMarketAuthority: sdkAddress(KAMINO_FIXTURE.lendingMarketAuthority.toBase58()),
        borrowReserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        borrowReserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        reserveSourceLiquidity: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        borrowReserveLiquidityFeeReceiver: sdkAddress(KAMINO_FIXTURE.reserveFeeVault.toBase58()),
        userDestinationLiquidity: sdkAddress(KAMINO_FIXTURE.userDestinationLiquidity.toBase58()),
        referrerTokenState: none(),
        tokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        instructionSysvarAccount: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(String(PROGRAM_ID));
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    const expectedKeys = comparableSdkAccounts(sdkInstruction.accounts as never);

    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(expectedKeys.map((entry) => entry.pubkey));
    expect(runtimePreview.keys.slice(0, 9)).toEqual(expectedKeys.slice(0, 9));
    expect(runtimePreview.keys[9]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: true,
    });
    expect(expectedKeys[9]).toEqual({
      pubkey: KAMINO_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
    expect(runtimePreview.keys.slice(10)).toEqual(expectedKeys.slice(10));
  });

  it('matches SDK instruction encoding for repay', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'repay',
      input: {
        owner: KAMINO_FIXTURE.owner.toBase58(),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        repay_reserve: KAMINO_FIXTURE.reserve.toBase58(),
        reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        reserve_destination_liquidity: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        user_source_liquidity: KAMINO_FIXTURE.userSourceLiquidity.toBase58(),
        token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        liquidity_amount: '250000',
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
    const sdkInstruction = repayObligationLiquidity(
      { liquidityAmount: new BN(prepared.args.liquidity_amount as string) },
      {
        owner: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: sdkAddress(KAMINO_FIXTURE.obligation.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        repayReserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        reserveLiquidityMint: sdkAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58()),
        reserveDestinationLiquidity: sdkAddress(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58()),
        userSourceLiquidity: sdkAddress(KAMINO_FIXTURE.userSourceLiquidity.toBase58()),
        tokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        instructionSysvarAccount: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(sdkInstruction.accounts as never));
  });

  it('matches SDK instruction encoding for withdraw', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'withdraw',
      input: {
        owner: KAMINO_FIXTURE.owner.toBase58(),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        lending_market_authority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        withdraw_reserve: KAMINO_FIXTURE.reserve.toBase58(),
        reserve_source_collateral: KAMINO_FIXTURE.reserveCollateralSupply.toBase58(),
        user_destination_collateral: KAMINO_FIXTURE.userDestinationCollateral.toBase58(),
        token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
        collateral_amount: '100000',
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
    const sdkInstruction = withdrawObligationCollateral(
      { collateralAmount: new BN(prepared.args.collateral_amount as string) },
      {
        owner: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: sdkAddress(KAMINO_FIXTURE.obligation.toBase58()),
        lendingMarket: sdkAddress(KAMINO_FIXTURE.lendingMarket.toBase58()),
        lendingMarketAuthority: sdkAddress(KAMINO_FIXTURE.lendingMarketAuthority.toBase58()),
        withdrawReserve: sdkAddress(KAMINO_FIXTURE.reserve.toBase58()),
        reserveSourceCollateral: sdkAddress(KAMINO_FIXTURE.reserveCollateralSupply.toBase58()),
        userDestinationCollateral: sdkAddress(KAMINO_FIXTURE.userDestinationCollateral.toBase58()),
        tokenProgram: sdkAddress(KAMINO_FIXTURE.tokenProgram.toBase58()),
        instructionSysvarAccount: sdkAddress(KAMINO_FIXTURE.instructionSysvar.toBase58()),
      },
    );

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(instructionDataAsBuffer(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(sdkInstruction.accounts as never));
  });

  it('matches SDK PDA derivation for the lending market, reserve, and obligation accounts', async () => {
    const view = await runRuntimeView({
      protocolId: KAMINO_PROTOCOL_ID,
      operationId: 'derive_accounts',
      input: {
        owner: KAMINO_FIXTURE.owner.toBase58(),
        lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
        reserve: KAMINO_FIXTURE.reserve.toBase58(),
      },
      connection: {} as never,
      walletPublicKey: KAMINO_FIXTURE.owner,
    });

    expect(view.derived.lending_market_authority).toBe(KAMINO_FIXTURE.lendingMarketAuthority.toBase58());
    expect(view.derived.reserve_liquidity_supply).toBe(KAMINO_FIXTURE.reserveLiquiditySupply.toBase58());
    expect(view.derived.reserve_collateral_mint).toBe(KAMINO_FIXTURE.reserveCollateralMint.toBase58());
    expect(view.derived.reserve_collateral_supply).toBe(KAMINO_FIXTURE.reserveCollateralSupply.toBase58());
    expect(view.derived.reserve_fee_vault).toBe(KAMINO_FIXTURE.reserveFeeVault.toBase58());
    expect(view.derived.obligation).toBe(KAMINO_FIXTURE.obligation.toBase58());
  });

  it('decodes the obligation fixture bytes with the SDK decoder', () => {
    const decoded = Obligation.decode(KAMINO_FIXTURE.obligationBytes).toJSON();
    const expected = KAMINO_FIXTURE.obligationAccount.toJSON();

    expect(decoded.owner).toBe(expected.owner);
    expect(decoded.lendingMarket).toBe(expected.lendingMarket);
    expect(decoded.deposits[0].depositReserve).toBe(expected.deposits[0].depositReserve);
    expect(decoded.deposits[0].depositedAmount).toBe(expected.deposits[0].depositedAmount);
    expect(decoded.borrows[0].borrowReserve).toBe(expected.borrows[0].borrowReserve);
    expect(decoded.borrows[0].borrowedAmountSf).toBe(expected.borrows[0].borrowedAmountSf);
    expect(decoded.allowedBorrowValueSf).toBe(expected.allowedBorrowValueSf);
    expect(decoded.unhealthyBorrowValueSf).toBe(expected.unhealthyBorrowValueSf);
    expect(decoded.hasDebt).toBe(1);
  });
});
