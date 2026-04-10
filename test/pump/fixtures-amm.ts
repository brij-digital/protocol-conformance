import fs from 'node:fs';
import BN from 'bn.js';
import {
  AccountLayout,
  getAssociatedTokenAddressSync,
  MintLayout,
  TOKEN_PROGRAM_ID,
  type RawMint,
} from '@solana/spl-token';
import { DirectAccountsCoder } from '@brij-digital/apppack-runtime/directAccountsCoder';
import {
  GLOBAL_CONFIG_PDA,
  PUMP_AMM_FEE_CONFIG_PDA,
  PumpAmmSdk,
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
  poolPda,
  poolV2Pda,
  pumpPoolAuthorityPda,
  userVolumeAccumulatorPda,
  type FeeConfig,
  type GlobalConfig,
  type Pool,
  type SwapSolanaState,
} from '@pump-fun/pump-swap-sdk';
import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { StaticAccountConnection } from '../../src/support/runtime.js';

export const PUMP_AMM_PROTOCOL_ID = 'pump-amm-mainnet';
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const PUMP_AMM_PROGRAM = new PublicKey(PUMP_AMM_PROGRAM_ID);
export const PUMP_AMM_SDK = new PumpAmmSdk();

export const TEST_WALLET = '11111111111111111111111111111111';
export const BASE_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6dTLK7YaB1pPB263';
export const QUOTE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const COIN_CREATOR = '9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu';
export const ADMIN = 'GyGKxMyg1p9SsHfm15MkNUu1u9TN2JtTspcdmrtGUdse';
export const ADMIN_SET_COIN_CREATOR_AUTHORITY = 'EdmxWPmx2WH6WgFfTdu9xfkYf3k1g5wD1zccTVySEEh1';
export const WHITELIST_PDA = '8SFqwqnq4whPhs8icwHA2hQg3hUoN1qrCLK1SBx3WKwe';
export const RESERVED_FEE_RECIPIENT = 'AKkzLhjhyFtM9j7WAhbaqYpFe49cXeJBg2kzLRC2PnNa';

const accountsCoder = new DirectAccountsCoder(
  JSON.parse(fs.readFileSync(new URL('../../../protocol-registry/codama/pump-amm.json', import.meta.url), 'utf8')),
);

const wallet = new PublicKey(TEST_WALLET);
const baseMint = new PublicKey(BASE_MINT);
const quoteMint = new PublicKey(QUOTE_MINT);
const coinCreator = new PublicKey(COIN_CREATOR);
const admin = new PublicKey(ADMIN);
const adminSetCoinCreatorAuthority = new PublicKey(ADMIN_SET_COIN_CREATOR_AUTHORITY);
const whitelistPda = new PublicKey(WHITELIST_PDA);
const reservedFeeRecipient = new PublicKey(RESERVED_FEE_RECIPIENT);
const poolCreator = pumpPoolAuthorityPda(baseMint);
const poolKey = poolPda(0, poolCreator, baseMint, quoteMint);
const poolBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, poolKey, true, TOKEN_PROGRAM_ID);
const poolQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, poolKey, true, TOKEN_PROGRAM_ID);
const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, wallet, false, TOKEN_PROGRAM_ID);
const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, wallet, false, TOKEN_PROGRAM_ID);
const protocolFeeRecipient = admin;
const protocolFeeRecipientTokenAccount = getAssociatedTokenAddressSync(
  quoteMint,
  protocolFeeRecipient,
  false,
  TOKEN_PROGRAM_ID,
);
const coinCreatorVaultAuthority = coinCreatorVaultAuthorityPda(coinCreator);
const coinCreatorVaultAta = coinCreatorVaultAtaPda(coinCreatorVaultAuthority, quoteMint, TOKEN_PROGRAM_ID);
const poolV2 = poolV2Pda(baseMint);
const userVolumeAccumulator = userVolumeAccumulatorPda(wallet);

const baseMintRaw: RawMint = {
  mintAuthorityOption: 1,
  mintAuthority: admin,
  supply: 5_000_000_000n,
  decimals: 6,
  isInitialized: true,
  freezeAuthorityOption: 0,
  freezeAuthority: PublicKey.default,
};

const globalConfig: GlobalConfig = {
  admin,
  lpFeeBasisPoints: new BN(80),
  protocolFeeBasisPoints: new BN(20),
  disableFlags: 0,
  protocolFeeRecipients: [protocolFeeRecipient],
  coinCreatorFeeBasisPoints: new BN(30),
  adminSetCoinCreatorAuthority,
  whitelistPda,
  reservedFeeRecipient,
  mayhemModeEnabled: false,
  reservedFeeRecipients: [],
};

const feeConfig: FeeConfig = {
  admin,
  flatFees: {
    lpFeeBps: new BN(100),
    protocolFeeBps: new BN(25),
    creatorFeeBps: new BN(50),
  },
  feeTiers: [
    {
      marketCapLamportsThreshold: new BN('500000000000'),
      fees: {
        lpFeeBps: new BN(120),
        protocolFeeBps: new BN(30),
        creatorFeeBps: new BN(40),
      },
    },
  ],
};

const pool: Pool = {
  poolBump: 254,
  index: 0,
  creator: poolCreator,
  baseMint,
  quoteMint,
  lpMint: getAssociatedTokenAddressSync(poolKey, wallet, true, TOKEN_PROGRAM_ID),
  poolBaseTokenAccount,
  poolQuoteTokenAccount,
  lpSupply: new BN(2_000_000_000),
  coinCreator: coinCreator,
  isMayhemMode: false,
  isCashbackCoin: false,
};

const poolBaseAmount = new BN(2_500_000_000);
const poolQuoteAmount = new BN(7_500_000_000);

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

function accountInfo(owner: PublicKey, data: Buffer): AccountInfo<Buffer> {
  return {
    executable: false,
    lamports: 0,
    owner,
    rentEpoch: 0,
    data,
  };
}

export async function buildPumpAmmConnection() {
  const connection = new StaticAccountConnection();
  connection.setRawAccount(
    poolKey.toBase58(),
    PUMP_AMM_PROGRAM_ID,
    await accountsCoder.encode('Pool', {
      pool_bump: pool.poolBump,
      index: pool.index,
      creator: pool.creator,
      base_mint: pool.baseMint,
      quote_mint: pool.quoteMint,
      lp_mint: pool.lpMint,
      pool_base_token_account: pool.poolBaseTokenAccount,
      pool_quote_token_account: pool.poolQuoteTokenAccount,
      lp_supply: pool.lpSupply,
      coin_creator: pool.coinCreator,
      is_mayhem_mode: pool.isMayhemMode,
      is_cashback_coin: pool.isCashbackCoin,
    }),
  );
  connection.setRawAccount(
    GLOBAL_CONFIG_PDA.toBase58(),
    PUMP_AMM_PROGRAM_ID,
    await accountsCoder.encode('GlobalConfig', {
      admin,
      lp_fee_basis_points: globalConfig.lpFeeBasisPoints,
      protocol_fee_basis_points: globalConfig.protocolFeeBasisPoints,
      disable_flags: globalConfig.disableFlags,
      protocol_fee_recipients: globalConfig.protocolFeeRecipients,
      coin_creator_fee_basis_points: globalConfig.coinCreatorFeeBasisPoints,
      admin_set_coin_creator_authority: globalConfig.adminSetCoinCreatorAuthority,
      whitelist_pda: globalConfig.whitelistPda,
      reserved_fee_recipient: globalConfig.reservedFeeRecipient,
      mayhem_mode_enabled: globalConfig.mayhemModeEnabled,
      reserved_fee_recipients: globalConfig.reservedFeeRecipients,
    }),
  );
  connection.setRawAccount(
    PUMP_AMM_FEE_CONFIG_PDA.toBase58(),
    'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ',
    await accountsCoder.encode('FeeConfig', {
      bump: 255,
      admin,
      flat_fees: {
        lp_fee_bps: feeConfig.flatFees.lpFeeBps,
        protocol_fee_bps: feeConfig.flatFees.protocolFeeBps,
        creator_fee_bps: feeConfig.flatFees.creatorFeeBps,
      },
      fee_tiers: feeConfig.feeTiers.map((tier) => ({
        market_cap_lamports_threshold: tier.marketCapLamportsThreshold,
        fees: {
          lp_fee_bps: tier.fees.lpFeeBps,
          protocol_fee_bps: tier.fees.protocolFeeBps,
          creator_fee_bps: tier.fees.creatorFeeBps,
        },
      })),
    }),
  );
  connection.setRawAccount(BASE_MINT, TOKEN_PROGRAM_ID.toBase58(), encodeMint(baseMintRaw));
  connection.setRawAccount(QUOTE_MINT, TOKEN_PROGRAM_ID.toBase58(), encodeMint({ ...baseMintRaw, supply: 20_000_000_000n }));
  connection.setRawAccount(
    poolBaseTokenAccount.toBase58(),
    TOKEN_PROGRAM_ID.toBase58(),
    encodeTokenAccount({ mint: baseMint, owner: poolKey, amount: BigInt(poolBaseAmount.toString()) }),
  );
  connection.setRawAccount(
    poolQuoteTokenAccount.toBase58(),
    TOKEN_PROGRAM_ID.toBase58(),
    encodeTokenAccount({ mint: quoteMint, owner: poolKey, amount: BigInt(poolQuoteAmount.toString()) }),
  );
  return connection;
}

export function buildPumpAmmSdkState(): SwapSolanaState {
  return {
    globalConfig,
    feeConfig,
    poolKey,
    poolAccountInfo: accountInfo(PUMP_AMM_PROGRAM, Buffer.alloc(300)),
    pool,
    poolBaseAmount,
    poolQuoteAmount,
    baseTokenProgram: TOKEN_PROGRAM_ID,
    quoteTokenProgram: TOKEN_PROGRAM_ID,
    baseMint,
    baseMintAccount: baseMintRaw,
    user: wallet,
    userBaseTokenAccount,
    userQuoteTokenAccount,
    userBaseAccountInfo: accountInfo(TOKEN_PROGRAM_ID, encodeTokenAccount({ mint: baseMint, owner: wallet, amount: 0n })),
    userQuoteAccountInfo: accountInfo(
      TOKEN_PROGRAM_ID,
      encodeTokenAccount({ mint: quoteMint, owner: wallet, amount: 1_000_000_000n }),
    ),
  };
}

export const PUMP_AMM_FIXTURE = {
  wallet,
  baseMint,
  quoteMint,
  poolKey,
  globalConfigPda: GLOBAL_CONFIG_PDA,
  feeConfigPda: PUMP_AMM_FEE_CONFIG_PDA,
  pool,
  globalConfig,
  feeConfig,
  poolBaseAmount,
  poolQuoteAmount,
  userBaseTokenAccount,
  userQuoteTokenAccount,
  poolBaseTokenAccount,
  poolQuoteTokenAccount,
  protocolFeeRecipient,
  protocolFeeRecipientTokenAccount,
  coinCreatorVaultAuthority,
  coinCreatorVaultAta,
  poolV2,
  userVolumeAccumulator,
  sdkState: buildPumpAmmSdkState,
};
