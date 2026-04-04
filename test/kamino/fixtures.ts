import BN from 'bn.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  LendingMarket,
  Obligation,
  PROGRAM_ID,
  Reserve,
  VanillaObligation,
  lendingMarketAuthPda,
  reservePdas,
} from '@kamino-finance/klend-sdk';
import { PublicKey } from '@solana/web3.js';
import { StaticAccountConnection } from '../../src/support/runtime.js';

export const KAMINO_PROTOCOL_ID = 'kamino-lending-mainnet';
export const KAMINO_PROGRAM_ID = String(PROGRAM_ID);
export const KAMINO_PROGRAM = new PublicKey(KAMINO_PROGRAM_ID);
export const KAMINO_OWNER = new PublicKey('9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu');
export const KAMINO_LENDING_MARKET = new PublicKey('6H1RjvQv5vVhQ7m6d6rS8dW4fM7gP7J9u2qVY8Q4k4zK');
export const KAMINO_RESERVE = new PublicKey('7bN5q2w4u7iZL6QX9Y6Nn5vK3mLxG8sP5cH4dK2rA1pE');
export const KAMINO_LIQUIDITY_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const SYSVAR_INSTRUCTIONS = new PublicKey('Sysvar1nstructions1111111111111111111111111');

function cloneZeroedAccount<T extends { constructor: { discriminator: Buffer; layout: { span: number; encode: (value: unknown, buffer: Buffer) => number } } }>(
  accountClass: T['constructor'] & {
    decode: (buffer: Buffer) => T;
  },
): T {
  const buffer = Buffer.alloc(8 + accountClass.layout.span);
  accountClass.discriminator.copy(buffer, 0);
  return accountClass.decode(buffer);
}

function encodeAccount<T extends { constructor: { discriminator: Buffer; layout: { span: number; encode: (value: unknown, buffer: Buffer) => number } } }>(
  accountClass: T['constructor'] & {
    discriminator: Buffer;
    layout: { span: number; encode: (value: unknown, buffer: Buffer) => number };
  },
  account: T,
): Buffer {
  const body = Buffer.alloc(accountClass.layout.span);
  accountClass.layout.encode(account, body);
  return Buffer.concat([accountClass.discriminator, body]);
}

export async function createKaminoFixture() {
  const [lendingMarketAuthority, lendingMarketAuthorityBump] = await lendingMarketAuthPda(
    KAMINO_LENDING_MARKET.toBase58(),
    KAMINO_PROGRAM_ID,
  );
  const reserveAddresses = await reservePdas(KAMINO_PROGRAM_ID, KAMINO_RESERVE.toBase58());
  const obligation = new PublicKey(
    await new VanillaObligation(KAMINO_PROGRAM_ID).toPda(
      KAMINO_LENDING_MARKET.toBase58(),
      KAMINO_OWNER.toBase58(),
    ),
  );
  const reserveLiquiditySupply = new PublicKey(reserveAddresses.liquiditySupplyVault);
  const reserveCollateralMint = new PublicKey(reserveAddresses.collateralMint);
  const reserveCollateralSupply = new PublicKey(reserveAddresses.collateralSupplyVault);
  const reserveFeeVault = new PublicKey(reserveAddresses.feeVault);
  const userSourceLiquidity = getAssociatedTokenAddressSync(KAMINO_LIQUIDITY_MINT, KAMINO_OWNER, false, TOKEN_PROGRAM_ID);
  const userDestinationLiquidity = userSourceLiquidity;
  const userDestinationCollateral = getAssociatedTokenAddressSync(reserveCollateralMint, KAMINO_OWNER, false, TOKEN_PROGRAM_ID);

  const lendingMarketAccount = cloneZeroedAccount(LendingMarket);
  lendingMarketAccount.version = new BN(1);
  lendingMarketAccount.bumpSeed = new BN(lendingMarketAuthorityBump);
  lendingMarketAccount.lendingMarketOwner = KAMINO_OWNER.toBase58();
  lendingMarketAccount.lendingMarketOwnerCached = KAMINO_OWNER.toBase58();
  lendingMarketAccount.referralFeeBps = 50;
  lendingMarketAccount.autodeleverageEnabled = 1;
  lendingMarketAccount.globalAllowedBorrowValue = new BN('500000000000');
  lendingMarketAccount.minNetValueInObligationSf = new BN('1000000');
  lendingMarketAccount.minInitialDepositAmount = new BN('1000');
  lendingMarketAccount.name = Array.from(Buffer.from('KAMINO_MAINNET'.padEnd(32, '\0')));
  lendingMarketAccount.proposerAuthority = KAMINO_OWNER.toBase58();

  const reserveAccount = cloneZeroedAccount(Reserve);
  reserveAccount.version = new BN(1);
  reserveAccount.lendingMarket = KAMINO_LENDING_MARKET.toBase58();
  reserveAccount.liquidity.mintPubkey = KAMINO_LIQUIDITY_MINT.toBase58();
  reserveAccount.liquidity.supplyVault = reserveLiquiditySupply.toBase58();
  reserveAccount.liquidity.feeVault = reserveFeeVault.toBase58();
  reserveAccount.liquidity.availableAmount = new BN('900000000');
  reserveAccount.liquidity.borrowedAmountSf = new BN('150000000');
  reserveAccount.liquidity.marketPriceSf = new BN('1000000000000000000');
  reserveAccount.liquidity.mintDecimals = 6;
  reserveAccount.liquidity.cumulativeBorrowRateBsf = new BN('1005000000000000000');
  reserveAccount.liquidity.tokenProgram = TOKEN_PROGRAM_ID.toBase58();
  reserveAccount.collateral.mintPubkey = reserveCollateralMint.toBase58();
  reserveAccount.collateral.mintTotalSupply = new BN('300000000');
  reserveAccount.collateral.supplyVault = reserveCollateralSupply.toBase58();
  reserveAccount.config.loanToValuePct = 75;
  reserveAccount.config.liquidationThresholdPct = 80;
  reserveAccount.config.minLiquidationBonusBps = 100;
  reserveAccount.config.maxLiquidationBonusBps = 500;
  reserveAccount.config.borrowFactorPct = new BN(100);
  reserveAccount.config.depositLimit = new BN('1000000000000');
  reserveAccount.config.borrowLimit = new BN('700000000000');
  reserveAccount.config.borrowRateCurve.points[0].utilizationRateBps = 0;
  reserveAccount.config.borrowRateCurve.points[0].borrowRateBps = 100;
  reserveAccount.config.borrowRateCurve.points[1].utilizationRateBps = 8000;
  reserveAccount.config.borrowRateCurve.points[1].borrowRateBps = 650;
  reserveAccount.config.tokenInfo.name = Array.from(Buffer.from('USDC'.padEnd(32, '\0')));
  reserveAccount.config.tokenInfo.heuristic.lower = new BN('990000');
  reserveAccount.config.tokenInfo.heuristic.upper = new BN('1010000');
  reserveAccount.config.tokenInfo.heuristic.exp = new BN(6);

  const obligationAccount = cloneZeroedAccount(Obligation);
  obligationAccount.tag = new BN(0);
  obligationAccount.lendingMarket = KAMINO_LENDING_MARKET.toBase58();
  obligationAccount.owner = KAMINO_OWNER.toBase58();
  obligationAccount.deposits[0].depositReserve = KAMINO_RESERVE.toBase58();
  obligationAccount.deposits[0].depositedAmount = new BN('250000000');
  obligationAccount.deposits[0].marketValueSf = new BN('300000000000000000');
  obligationAccount.deposits[0].borrowedAmountAgainstThisCollateralInElevationGroup = new BN('0');
  obligationAccount.lowestReserveDepositLiquidationLtv = new BN(80);
  obligationAccount.depositedValueSf = new BN('300000000000000000');
  obligationAccount.borrows[0].borrowReserve = KAMINO_RESERVE.toBase58();
  obligationAccount.borrows[0].cumulativeBorrowRateBsf = new BN('1005000000000000000');
  obligationAccount.borrows[0].borrowedAmountSf = new BN('120000000000000000');
  obligationAccount.borrows[0].marketValueSf = new BN('120000000000000000');
  obligationAccount.borrows[0].borrowFactorAdjustedMarketValueSf = new BN('120000000000000000');
  obligationAccount.borrowFactorAdjustedDebtValueSf = new BN('120000000000000000');
  obligationAccount.borrowedAssetsMarketValueSf = new BN('120000000000000000');
  obligationAccount.allowedBorrowValueSf = new BN('225000000000000000');
  obligationAccount.unhealthyBorrowValueSf = new BN('240000000000000000');
  obligationAccount.hasDebt = 1;
  obligationAccount.lowestReserveDepositMaxLtvPct = 75;
  obligationAccount.highestBorrowFactorPct = new BN(100);

  return {
    owner: KAMINO_OWNER,
    lendingMarket: KAMINO_LENDING_MARKET,
    lendingMarketAuthority: new PublicKey(lendingMarketAuthority),
    reserve: KAMINO_RESERVE,
    reserveLiquidityMint: KAMINO_LIQUIDITY_MINT,
    reserveLiquiditySupply,
    reserveCollateralMint,
    reserveCollateralSupply,
    reserveFeeVault,
    obligation,
    userSourceLiquidity,
    userDestinationLiquidity,
    userDestinationCollateral,
    instructionSysvar: SYSVAR_INSTRUCTIONS,
    tokenProgram: TOKEN_PROGRAM_ID,
    collateralTokenProgram: TOKEN_PROGRAM_ID,
    lendingMarketAccount,
    reserveAccount,
    obligationAccount,
    lendingMarketBytes: Buffer.alloc(0),
    reserveBytes: Buffer.alloc(0),
    obligationBytes: encodeAccount(Obligation, obligationAccount),
  };
}

export const KAMINO_FIXTURE = await createKaminoFixture();

export async function buildKaminoConnection() {
  const connection = new StaticAccountConnection();
  connection.setRawAccount(
    KAMINO_FIXTURE.lendingMarket.toBase58(),
    KAMINO_PROGRAM_ID,
    KAMINO_FIXTURE.lendingMarketBytes,
  );
  connection.setRawAccount(
    KAMINO_FIXTURE.reserve.toBase58(),
    KAMINO_PROGRAM_ID,
    KAMINO_FIXTURE.reserveBytes,
  );
  connection.setRawAccount(
    KAMINO_FIXTURE.obligation.toBase58(),
    KAMINO_PROGRAM_ID,
    KAMINO_FIXTURE.obligationBytes,
  );
  return connection;
}
