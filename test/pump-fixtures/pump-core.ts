import fs from 'node:fs';
import BN from 'bn.js';
import {
  AccountLayout,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_PROGRAM_ID,
  type RawMint,
} from '@solana/spl-token';
import { DirectAccountsCoder } from '@brij-digital/apppack-runtime';
import {
  GLOBAL_PDA,
  PumpSdk,
  bondingCurvePda,
  bondingCurveV2Pda,
  creatorVaultPda,
  getBuyTokenAmountFromSolAmount,
  type BondingCurve,
  type Global,
} from '@pump-fun/pump-sdk';
import { PublicKey } from '@solana/web3.js';
import { StaticAccountConnection } from '../../src/support/runtime.js';

export const PUMP_CORE_PROTOCOL_ID = 'pump-core-mainnet';
export const PUMP_CORE_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const PUMP_CORE_SDK = new PumpSdk();

export const TEST_WALLET = '11111111111111111111111111111111';
export const BASE_MINT = '7vfCXTUXx5Wb9R67qumM6HAuA9x2uVH54camzatoNgtr';
export const AUTHORITY = '9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu';
export const FEE_RECIPIENT = 'GyGKxMyg1p9SsHfm15MkNUu1u9TN2JtTspcdmrtGUdse';
export const WITHDRAW_AUTHORITY = 'EdmxWPmx2WH6WgFfTdu9xfkYf3k1g5wD1zccTVySEEh1';
export const SET_CREATOR_AUTHORITY = '8SFqwqnq4whPhs8icwHA2hQg3hUoN1qrCLK1SBx3WKwe';
export const ADMIN_SET_CREATOR_AUTHORITY = 'AKkzLhjhyFtM9j7WAhbaqYpFe49cXeJBg2kzLRC2PnNa';
export const WHITELIST_PDA = 'GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB';
export const RESERVED_FEE_RECIPIENT = '2KW2XRd9kwqet15Aha2oK3tYvd3nWbTFH1MBiRAv1BE1';

const accountsCoder = new DirectAccountsCoder(
  JSON.parse(fs.readFileSync(new URL('../../../ec-ai-wallet/public/idl/pump_core.codama.json', import.meta.url), 'utf8')),
);

const wallet = new PublicKey(TEST_WALLET);
const baseMint = new PublicKey(BASE_MINT);
const authority = new PublicKey(AUTHORITY);
const feeRecipient = new PublicKey(FEE_RECIPIENT);
const withdrawAuthority = new PublicKey(WITHDRAW_AUTHORITY);
const setCreatorAuthority = new PublicKey(SET_CREATOR_AUTHORITY);
const adminSetCreatorAuthority = new PublicKey(ADMIN_SET_CREATOR_AUTHORITY);
const whitelistPda = new PublicKey(WHITELIST_PDA);
const reservedFeeRecipient = new PublicKey(RESERVED_FEE_RECIPIENT);
const bondingCurve = bondingCurvePda(baseMint);
const bondingCurveV2 = bondingCurveV2Pda(baseMint);
const associatedBondingCurve = getAssociatedTokenAddressSync(baseMint, bondingCurve, true, TOKEN_PROGRAM_ID);
const associatedUser = getAssociatedTokenAddressSync(baseMint, wallet, false, TOKEN_PROGRAM_ID);
const creatorVault = creatorVaultPda(authority);

const mintRaw: RawMint = {
  mintAuthorityOption: 1,
  mintAuthority: authority,
  supply: 1_000_000_000_000_000n,
  decimals: 6,
  isInitialized: true,
  freezeAuthorityOption: 0,
  freezeAuthority: PublicKey.default,
};

const global: Global = {
  initialized: true,
  authority,
  feeRecipient,
  initialVirtualTokenReserves: new BN('1000000000000000'),
  initialVirtualSolReserves: new BN('30000000000'),
  initialRealTokenReserves: new BN('793100000000000'),
  tokenTotalSupply: new BN('1000000000000000'),
  feeBasisPoints: new BN(80),
  withdrawAuthority,
  enableMigrate: true,
  poolMigrationFee: new BN(0),
  creatorFeeBasisPoints: new BN(20),
  feeRecipients: [],
  setCreatorAuthority,
  adminSetCreatorAuthority,
  createV2Enabled: true,
  whitelistPda,
  reservedFeeRecipient,
  mayhemModeEnabled: false,
  reservedFeeRecipients: [],
};

const bondingCurveData: BondingCurve = {
  virtualTokenReserves: new BN('900000000000000'),
  virtualSolReserves: new BN('25000000000'),
  realTokenReserves: new BN('700000000000000'),
  realSolReserves: new BN('5000000000'),
  tokenTotalSupply: global.tokenTotalSupply,
  complete: false,
  creator: authority,
  isMayhemMode: false,
  isCashbackCoin: false,
};

function encodeMint(raw: RawMint): Buffer {
  const data = Buffer.alloc(MintLayout.span);
  MintLayout.encode(raw, data);
  return data;
}

function encodeTokenAccount(args: {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
}): Buffer {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint: args.mint,
      owner: args.owner,
      amount: args.amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return data;
}

export async function buildPumpCoreConnection() {
  const connection = new StaticAccountConnection();
  connection.setRawAccount(
    GLOBAL_PDA.toBase58(),
    PUMP_CORE_PROGRAM_ID,
    await accountsCoder.encode('Global', {
      initialized: global.initialized,
      authority: global.authority,
      fee_recipient: global.feeRecipient,
      initial_virtual_token_reserves: global.initialVirtualTokenReserves,
      initial_virtual_sol_reserves: global.initialVirtualSolReserves,
      initial_real_token_reserves: global.initialRealTokenReserves,
      token_total_supply: global.tokenTotalSupply,
      fee_basis_points: global.feeBasisPoints,
      withdraw_authority: global.withdrawAuthority,
      enable_migrate: global.enableMigrate,
      pool_migration_fee: global.poolMigrationFee,
      creator_fee_basis_points: global.creatorFeeBasisPoints,
      fee_recipients: global.feeRecipients,
      set_creator_authority: global.setCreatorAuthority,
      admin_set_creator_authority: global.adminSetCreatorAuthority,
      create_v2_enabled: global.createV2Enabled,
      whitelist_pda: global.whitelistPda,
      reserved_fee_recipient: global.reservedFeeRecipient,
      mayhem_mode_enabled: global.mayhemModeEnabled,
      reserved_fee_recipients: global.reservedFeeRecipients,
    }),
  );
  connection.setRawAccount(
    bondingCurve.toBase58(),
    PUMP_CORE_PROGRAM_ID,
    await accountsCoder.encode('BondingCurve', {
      virtual_token_reserves: bondingCurveData.virtualTokenReserves,
      virtual_sol_reserves: bondingCurveData.virtualSolReserves,
      real_token_reserves: bondingCurveData.realTokenReserves,
      real_sol_reserves: bondingCurveData.realSolReserves,
      token_total_supply: bondingCurveData.tokenTotalSupply,
      complete: bondingCurveData.complete,
      creator: bondingCurveData.creator,
      is_mayhem_mode: bondingCurveData.isMayhemMode,
      is_cashback_coin: bondingCurveData.isCashbackCoin,
    }),
  );
  connection.setRawAccount(BASE_MINT, TOKEN_PROGRAM_ID.toBase58(), encodeMint(mintRaw));
  connection.setRawAccount(
    associatedBondingCurve.toBase58(),
    TOKEN_PROGRAM_ID.toBase58(),
    encodeTokenAccount({
      mint: baseMint,
      owner: bondingCurve,
      amount: BigInt(bondingCurveData.realTokenReserves.toString()),
    }),
  );
  return connection;
}

export function estimateBuyTokens(spendableSolIn: BN): BN {
  return getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: null,
    mintSupply: mintRaw.supply === null ? null : new BN(mintRaw.supply.toString()),
    bondingCurve: bondingCurveData,
    amount: spendableSolIn,
  });
}

export const PUMP_CORE_FIXTURE = {
  wallet,
  baseMint,
  globalPda: GLOBAL_PDA,
  bondingCurve,
  bondingCurveV2,
  associatedBondingCurve,
  associatedUser,
  creatorVault,
  feeRecipient,
  global,
  bondingCurveData,
  mintRaw,
};
