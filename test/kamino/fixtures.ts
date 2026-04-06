import BN from 'bn.js';
import { Decimal } from 'decimal.js';
import { address, type Address } from '@solana/kit';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  DEFAULT_RECENT_SLOT_DURATION_MS,
  KaminoMarket,
  KaminoReserve,
  LendingMarket,
  Obligation,
  PROGRAM_ID,
  Reserve,
  type TokenOracleData,
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
export const KAMINO_RECENT_SLOT_DURATION_MS = DEFAULT_RECENT_SLOT_DURATION_MS;

function asAddress(value: string): Address {
  return address(value);
}

function oneBsf() {
  return {
    value: [new BN('1152921504606846976'), new BN(0), new BN(0), new BN(0)],
    padding: [new BN(0), new BN(0)],
  };
}

function cloneZeroedAccount(accountClass: {
  layout: { span: number; decode: (buffer: Buffer) => any };
}): any {
  return accountClass.layout.decode(Buffer.alloc(accountClass.layout.span));
}

function encodeAccount(
  accountClass: {
    discriminator: Buffer;
    layout: { span: number; encode: (value: unknown, buffer: Buffer) => number };
  },
  account: unknown,
): Buffer {
  const body = Buffer.alloc(accountClass.layout.span);
  accountClass.layout.encode(account, body);
  return Buffer.concat([accountClass.discriminator, body]);
}

export async function createKaminoFixture() {
  const lendingMarketAddress = asAddress(KAMINO_LENDING_MARKET.toBase58());
  const reserveAddress = asAddress(KAMINO_RESERVE.toBase58());
  const programAddress = asAddress(KAMINO_PROGRAM_ID);
  const ownerAddress = asAddress(KAMINO_OWNER.toBase58());
  const [lendingMarketAuthority, lendingMarketAuthorityBump] = await lendingMarketAuthPda(
    lendingMarketAddress,
    programAddress,
  );
  const reserveAddresses = await reservePdas(programAddress, reserveAddress);
  const obligation = new PublicKey(
    await new VanillaObligation(programAddress).toPda(lendingMarketAddress, ownerAddress),
  );
  const reserveLiquiditySupply = new PublicKey(reserveAddresses.liquiditySupplyVault);
  const reserveCollateralMint = new PublicKey(reserveAddresses.collateralMint);
  const reserveCollateralSupply = new PublicKey(reserveAddresses.collateralSupplyVault);
  const reserveFeeVault = new PublicKey(reserveAddresses.feeVault);
  const userSourceLiquidity = getAssociatedTokenAddressSync(KAMINO_LIQUIDITY_MINT, KAMINO_OWNER, false, TOKEN_PROGRAM_ID);
  const userDestinationLiquidity = userSourceLiquidity;
  const userDestinationCollateral = getAssociatedTokenAddressSync(reserveCollateralMint, KAMINO_OWNER, false, TOKEN_PROGRAM_ID);

  const lendingMarketFields = cloneZeroedAccount(LendingMarket);
  lendingMarketFields.version = new BN(1);
  lendingMarketFields.bumpSeed = new BN(lendingMarketAuthorityBump);
  lendingMarketFields.lendingMarketOwner = KAMINO_OWNER.toBase58();
  lendingMarketFields.lendingMarketOwnerCached = KAMINO_OWNER.toBase58();
  lendingMarketFields.referralFeeBps = 50;
  lendingMarketFields.autodeleverageEnabled = 1;
  lendingMarketFields.globalAllowedBorrowValue = new BN('500000000000');
  lendingMarketFields.minNetValueInObligationSf = new BN('1000000');
  lendingMarketFields.minInitialDepositAmount = new BN('1000');
  lendingMarketFields.name = Array.from(Buffer.from('KAMINO_MAINNET'.padEnd(32, '\0')));
  lendingMarketFields.proposerAuthority = KAMINO_OWNER.toBase58();

  const reserveFields = cloneZeroedAccount(Reserve);
  reserveFields.version = new BN(1);
  reserveFields.lendingMarket = KAMINO_LENDING_MARKET.toBase58();
  reserveFields.liquidity.mintPubkey = KAMINO_LIQUIDITY_MINT.toBase58();
  reserveFields.liquidity.supplyVault = reserveLiquiditySupply.toBase58();
  reserveFields.liquidity.feeVault = reserveFeeVault.toBase58();
  reserveFields.liquidity.availableAmount = new BN('900000000');
  reserveFields.liquidity.borrowedAmountSf = new BN('150000000');
  reserveFields.liquidity.marketPriceSf = new BN('1000000000000000000');
  reserveFields.liquidity.mintDecimals = new BN(6);
  reserveFields.liquidity.cumulativeBorrowRateBsf = oneBsf();
  reserveFields.liquidity.tokenProgram = TOKEN_PROGRAM_ID.toBase58();
  reserveFields.collateral.mintPubkey = reserveCollateralMint.toBase58();
  reserveFields.collateral.mintTotalSupply = new BN('300000000');
  reserveFields.collateral.supplyVault = reserveCollateralSupply.toBase58();
  reserveFields.config.loanToValuePct = 75;
  reserveFields.config.liquidationThresholdPct = 80;
  reserveFields.config.minLiquidationBonusBps = 100;
  reserveFields.config.maxLiquidationBonusBps = 500;
  reserveFields.config.borrowFactorPct = new BN(100);
  reserveFields.config.depositLimit = new BN('1000000000000');
  reserveFields.config.borrowLimit = new BN('700000000000');
  reserveFields.config.borrowRateCurve.points[0].utilizationRateBps = 0;
  reserveFields.config.borrowRateCurve.points[0].borrowRateBps = 100;
  reserveFields.config.borrowRateCurve.points[1].utilizationRateBps = 8000;
  reserveFields.config.borrowRateCurve.points[1].borrowRateBps = 650;
  reserveFields.config.tokenInfo.name = Array.from(Buffer.from('USDC'.padEnd(32, '\0')));
  reserveFields.config.tokenInfo.heuristic.lower = new BN('990000');
  reserveFields.config.tokenInfo.heuristic.upper = new BN('1010000');
  reserveFields.config.tokenInfo.heuristic.exp = new BN(6);

  const obligationFields = cloneZeroedAccount(Obligation);
  obligationFields.tag = new BN(0);
  obligationFields.lendingMarket = KAMINO_LENDING_MARKET.toBase58();
  obligationFields.owner = KAMINO_OWNER.toBase58();
  obligationFields.deposits[0].depositReserve = KAMINO_RESERVE.toBase58();
  obligationFields.deposits[0].depositedAmount = new BN('250000000');
  obligationFields.deposits[0].marketValueSf = new BN('300000000000000000');
  obligationFields.deposits[0].borrowedAmountAgainstThisCollateralInElevationGroup = new BN('0');
  obligationFields.lowestReserveDepositLiquidationLtv = new BN(80);
  obligationFields.depositedValueSf = new BN('300000000000000000');
  obligationFields.borrows[0].borrowReserve = KAMINO_RESERVE.toBase58();
  obligationFields.borrows[0].cumulativeBorrowRateBsf = oneBsf();
  obligationFields.borrows[0].borrowedAmountSf = new BN('120000000000000000');
  obligationFields.borrows[0].marketValueSf = new BN('120000000000000000');
  obligationFields.borrows[0].borrowFactorAdjustedMarketValueSf = new BN('120000000000000000');
  obligationFields.borrowFactorAdjustedDebtValueSf = new BN('120000000000000000');
  obligationFields.borrowedAssetsMarketValueSf = new BN('120000000000000000');
  obligationFields.allowedBorrowValueSf = new BN('225000000000000000');
  obligationFields.unhealthyBorrowValueSf = new BN('240000000000000000');
  obligationFields.hasDebt = 1;
  obligationFields.lowestReserveDepositMaxLtvPct = 75;
  obligationFields.highestBorrowFactorPct = new BN(100);

  const lendingMarketBytes = encodeAccount(LendingMarket, lendingMarketFields);
  const reserveBytes = encodeAccount(Reserve, reserveFields);
  const obligationBytes = encodeAccount(Obligation, obligationFields);
  const lendingMarketAccount = LendingMarket.decode(lendingMarketBytes);
  const reserveAccount = Reserve.decode(reserveBytes);
  const obligationAccount = Obligation.decode(obligationBytes);

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
    lendingMarketBytes,
    reserveBytes,
    obligationBytes,
  };
}

export const KAMINO_FIXTURE = await createKaminoFixture();

export async function buildKaminoConnection() {
  const connection = new StaticAccountConnection();
  connection.setSlot(1n);
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

export async function buildOfflineKaminoMarket() {
  const connection = await buildKaminoConnection();
  const reserveLiquidityMintAddress = asAddress(KAMINO_FIXTURE.reserveLiquidityMint.toBase58());
  const reserveAddress = asAddress(KAMINO_FIXTURE.reserve.toBase58());
  const lendingMarketAddress = asAddress(KAMINO_FIXTURE.lendingMarket.toBase58());
  const programAddress = asAddress(KAMINO_PROGRAM_ID);
  const tokenOracleData: TokenOracleData = {
    mintAddress: reserveLiquidityMintAddress,
    decimals: new Decimal(10).pow(KAMINO_FIXTURE.reserveAccount.liquidity.mintDecimals.toString()),
    price: new Decimal(1),
    timestamp: 1n,
    valid: true,
  };
  const reserve = KaminoReserve.initialize(
    reserveAddress,
    KAMINO_FIXTURE.reserveAccount,
    tokenOracleData,
    connection as never,
    KAMINO_RECENT_SLOT_DURATION_MS,
    { deprecatedAssets: [] },
  );
  const reserves = new Map<Address, KaminoReserve>([[reserveAddress, reserve]]);

  return {
    connection,
    market: KaminoMarket.loadWithReserves(
      connection as never,
      KAMINO_FIXTURE.lendingMarketAccount,
      reserves,
      lendingMarketAddress,
      KAMINO_RECENT_SLOT_DURATION_MS,
      programAddress,
    ),
    reserve,
    obligationType: new VanillaObligation(programAddress),
  };
}
