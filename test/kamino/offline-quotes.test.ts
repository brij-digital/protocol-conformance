import BN from 'bn.js';
import { none } from '@solana/kit';
import {
  KaminoAction,
  KaminoObligation,
  LendingMarket,
  Reserve,
  withdrawObligationCollateralAndRedeemReserveCollateral,
} from '@kamino-finance/klend-sdk';
import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import {
  buildKaminoConnection,
  buildOfflineKaminoMarket,
  KAMINO_FIXTURE,
  KAMINO_PROGRAM_ID,
  KAMINO_PROTOCOL_ID,
} from './fixtures.js';

function sdkSigner(address: string) {
  return { address } as never;
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

async function previewRuntimeInstruction(operationId: 'deposit' | 'borrow' | 'repay' | 'withdraw', input: object) {
  const prepared = await prepareRuntimeInstruction({
    protocolId: KAMINO_PROTOCOL_ID,
    operationId,
    input,
    connection: {} as never,
    walletPublicKey: KAMINO_FIXTURE.owner,
  });

  return previewIdlInstruction({
    protocolId: KAMINO_PROTOCOL_ID,
    instructionName: prepared.instructionName,
    args: prepared.args,
    accounts: prepared.accounts,
    walletPublicKey: KAMINO_FIXTURE.owner,
  });
}

function getActionIx(action: KaminoAction, labelFragment: string) {
  const labels = KaminoAction.actionToLendingIxLabels(action);
  const index = labels.findIndex((label) => label.includes(labelFragment));
  expect(index).toBeGreaterThanOrEqual(0);
  return KaminoAction.actionToLendingIxs(action)[index]!;
}

describe('Kamino offline quotes', () => {
  it('loads lending market and reserve fixture bytes from the mock connection', async () => {
    const connection = await buildKaminoConnection();
    const [market, reserve] = await Promise.all([
      LendingMarket.fetch(connection as never, KAMINO_FIXTURE.lendingMarket.toBase58(), KAMINO_PROGRAM_ID),
      Reserve.fetch(connection as never, KAMINO_FIXTURE.reserve.toBase58(), KAMINO_PROGRAM_ID),
    ]);

    expect(market?.lendingMarketOwner).toBe(KAMINO_FIXTURE.owner.toBase58());
    expect(market?.proposerAuthority).toBe(KAMINO_FIXTURE.owner.toBase58());
    expect(reserve?.lendingMarket).toBe(KAMINO_FIXTURE.lendingMarket.toBase58());
    expect(reserve?.liquidity.mintPubkey).toBe(KAMINO_FIXTURE.reserveLiquidityMint.toBase58());
  });

  it('builds a deposit quote offline and matches the runtime spec instruction', async () => {
    const { market, obligationType } = await buildOfflineKaminoMarket();
    const action = await KaminoAction.buildDepositTxns(
      market,
      '1250000',
      KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
      sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
      obligationType,
      false,
      undefined,
      0,
      false,
    );
    const quoteIx = getActionIx(action, 'depositReserveLiquidityAndObligationCollateral');
    const runtimePreview = await previewRuntimeInstruction('deposit', {
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
    });

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(quoteIx.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(quoteIx.accounts as never));
  });

  it('builds a borrow quote offline and matches the runtime spec instruction', async () => {
    const { market, obligationType } = await buildOfflineKaminoMarket();
    const action = await KaminoAction.buildBorrowTxns(
      market,
      '500000',
      KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
      sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
      obligationType,
      false,
      undefined,
      0,
      false,
    );
    const quoteIx = getActionIx(action, 'borrowObligationLiquidity');
    const runtimePreview = await previewRuntimeInstruction('borrow', {
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
    });

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(quoteIx.data));
    const expectedKeys = comparableSdkAccounts(quoteIx.accounts as never);

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

  it('builds a repay quote offline and matches the runtime spec instruction', async () => {
    const { market, obligationType } = await buildOfflineKaminoMarket();
    const action = await KaminoAction.buildRepayTxns(
      market,
      '250000',
      KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
      sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
      obligationType,
      false,
      undefined,
      0n,
      sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
      0,
      false,
    );
    const quoteIx = getActionIx(action, 'repayObligationLiquidity');
    const runtimePreview = await previewRuntimeInstruction('repay', {
      owner: KAMINO_FIXTURE.owner.toBase58(),
      obligation: KAMINO_FIXTURE.obligation.toBase58(),
      lending_market: KAMINO_FIXTURE.lendingMarket.toBase58(),
      repay_reserve: KAMINO_FIXTURE.reserve.toBase58(),
      reserve_liquidity_mint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
      reserve_destination_liquidity: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
      user_source_liquidity: KAMINO_FIXTURE.userSourceLiquidity.toBase58(),
      token_program: KAMINO_FIXTURE.tokenProgram.toBase58(),
      liquidity_amount: '250000',
    });

    expect(runtimePreview.programId).toBe(KAMINO_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(quoteIx.data));
    expect(runtimePreview.keys).toEqual(comparableSdkAccounts(quoteIx.accounts as never));
  });

  it('builds a withdraw quote offline and matches the high-level SDK instruction', async () => {
    const { market, obligationType, reserve } = await buildOfflineKaminoMarket();
    const action = await KaminoAction.buildWithdrawTxns(
      market,
      '100000',
      KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
      sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
      obligationType,
      false,
      undefined,
      0,
      false,
    );
    const quoteIx = getActionIx(action, 'withdrawObligationCollateralAndRedeemReserveCollateral');
    const expectedCollateralAmount = action.getWithdrawCollateralAmount(reserve, new BN('100000'));
    const expectedIx = withdrawObligationCollateralAndRedeemReserveCollateral(
      { collateralAmount: expectedCollateralAmount },
      {
        owner: sdkSigner(KAMINO_FIXTURE.owner.toBase58()),
        obligation: KAMINO_FIXTURE.obligation.toBase58(),
        lendingMarket: KAMINO_FIXTURE.lendingMarket.toBase58(),
        lendingMarketAuthority: KAMINO_FIXTURE.lendingMarketAuthority.toBase58(),
        withdrawReserve: KAMINO_FIXTURE.reserve.toBase58(),
        reserveLiquidityMint: KAMINO_FIXTURE.reserveLiquidityMint.toBase58(),
        reserveCollateralMint: KAMINO_FIXTURE.reserveCollateralMint.toBase58(),
        reserveLiquiditySupply: KAMINO_FIXTURE.reserveLiquiditySupply.toBase58(),
        reserveSourceCollateral: KAMINO_FIXTURE.reserveCollateralSupply.toBase58(),
        userDestinationLiquidity: KAMINO_FIXTURE.userDestinationLiquidity.toBase58(),
        placeholderUserDestinationCollateral: none(),
        collateralTokenProgram: KAMINO_FIXTURE.collateralTokenProgram.toBase58(),
        liquidityTokenProgram: KAMINO_FIXTURE.tokenProgram.toBase58(),
        instructionSysvarAccount: KAMINO_FIXTURE.instructionSysvar.toBase58(),
      },
    );

    expect(Buffer.from(quoteIx.data)).toEqual(Buffer.from(expectedIx.data));
    expect(comparableSdkAccounts(quoteIx.accounts as never)).toEqual(
      comparableSdkAccounts(expectedIx.accounts as never),
    );
  });

  it('decodes reserve fixture bytes and verifies core reserve fields', () => {
    const decoded = Reserve.decode(KAMINO_FIXTURE.reserveBytes);

    expect(decoded.lendingMarket).toBe(KAMINO_FIXTURE.lendingMarket.toBase58());
    expect(decoded.liquidity.mintPubkey).toBe(KAMINO_FIXTURE.reserveLiquidityMint.toBase58());
    expect(decoded.liquidity.availableAmount.toString()).toBe('900000000');
    expect(decoded.collateral.supplyVault).toBe(KAMINO_FIXTURE.reserveCollateralSupply.toBase58());
    expect(decoded.config.loanToValuePct).toBe(75);
    expect(decoded.config.liquidationThresholdPct).toBe(80);
  });

  it('computes obligation health from decoded state and loaded reserve metadata', async () => {
    const { market, obligationType } = await buildOfflineKaminoMarket();
    const obligation = await KaminoObligation.load(market, await obligationType.toPda(
      KAMINO_FIXTURE.lendingMarket.toBase58(),
      KAMINO_FIXTURE.owner.toBase58(),
    ));
    const healthFactor = obligation!.liquidationLtv().div(obligation!.loanToValue());

    expect(obligation).not.toBeNull();
    expect(obligation?.getNumberOfPositions()).toBe(2);
    expect(obligation?.loanToValue().greaterThan(0)).toBe(true);
    expect(obligation?.liquidationLtv().greaterThan(obligation!.loanToValue())).toBe(true);
    expect(healthFactor.greaterThan(1)).toBe(true);
    expect(obligation?.getNetAccountValue().greaterThan(0)).toBe(true);
  });
});
