import BN from 'bn.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  GLOBAL_CONFIG_PDA,
  OFFLINE_PUMP_AMM_PROGRAM,
  poolV2Pda,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
  buyQuoteInput,
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
  sellBaseInput,
  type FeeConfig as PumpAmmFeeConfig,
  type GlobalConfig,
  type Pool,
} from '@pump-fun/pump-swap-sdk';
import {
  bondingCurvePda,
  bondingCurveV2Pda,
  creatorVaultPda,
  getBuyTokenAmountFromSolAmount,
  getPumpProgram,
  GLOBAL_PDA,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_PROGRAM_ID,
  type BondingCurve,
  type FeeConfig as PumpCoreFeeConfig,
  type Global,
} from '@pump-fun/pump-sdk';
import { StaticAccountConnection, getTestWallet } from '../support/runtime.js';

const CORE_PROGRAM = getPumpProgram({} as never);
const U64_BYTES = 8;
const U32_BYTES = 4;

function seededPubkey(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes.fill(seed);
  return new PublicKey(bytes);
}

function writeU32LE(buffer: Buffer, offset: number, value: number): number {
  buffer.writeUInt32LE(value, offset);
  return offset + U32_BYTES;
}

function writeU64LE(buffer: Buffer, offset: number, value: bigint): number {
  buffer.writeBigUInt64LE(value, offset);
  return offset + U64_BYTES;
}

function encodeMintAccount(options: {
  mintAuthority?: PublicKey | null;
  supply: bigint;
  decimals?: number;
  freezeAuthority?: PublicKey | null;
}): Buffer {
  const buffer = Buffer.alloc(82);
  let offset = 0;
  offset = writeU32LE(buffer, offset, options.mintAuthority ? 1 : 0);
  (options.mintAuthority ?? PublicKey.default).toBuffer().copy(buffer, offset);
  offset += 32;
  offset = writeU64LE(buffer, offset, options.supply);
  buffer.writeUInt8(options.decimals ?? 6, offset);
  offset += 1;
  buffer.writeUInt8(1, offset);
  offset += 1;
  offset = writeU32LE(buffer, offset, options.freezeAuthority ? 1 : 0);
  (options.freezeAuthority ?? PublicKey.default).toBuffer().copy(buffer, offset);
  return buffer;
}

function encodeTokenAccount(options: {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
}): Buffer {
  const buffer = Buffer.alloc(165);
  let offset = 0;
  options.mint.toBuffer().copy(buffer, offset);
  offset += 32;
  options.owner.toBuffer().copy(buffer, offset);
  offset += 32;
  offset = writeU64LE(buffer, offset, options.amount);
  offset = writeU32LE(buffer, offset, 0);
  PublicKey.default.toBuffer().copy(buffer, offset);
  offset += 32;
  buffer.writeUInt8(1, offset);
  offset += 1;
  offset = writeU32LE(buffer, offset, 0);
  offset = writeU64LE(buffer, offset, 0n);
  offset = writeU32LE(buffer, offset, 0);
  PublicKey.default.toBuffer().copy(buffer, offset);
  offset += 32;
  offset = writeU64LE(buffer, offset, 0n);
  return buffer;
}

function encodePumpAmmAccount(name: 'pool' | 'globalConfig' | 'feeConfig', value: Pool | GlobalConfig | PumpAmmFeeConfig) {
  return OFFLINE_PUMP_AMM_PROGRAM.coder.accounts.encode(name, value);
}

function encodePumpCoreAccount(name: 'global' | 'bondingCurve', value: Global | BondingCurve) {
  return CORE_PROGRAM.coder.accounts.encode(name, value);
}

export const PUMP_TEST_WALLET = getTestWallet().toBase58();
export const PUMP_BASE_MINT = seededPubkey(21).toBase58();
export const PUMP_QUOTE_MINT = seededPubkey(22).toBase58();
export const PUMP_LP_MINT = seededPubkey(23).toBase58();
export const PUMP_POOL = seededPubkey(24).toBase58();
export const PUMP_POOL_BASE_TOKEN_ACCOUNT = seededPubkey(25).toBase58();
export const PUMP_POOL_QUOTE_TOKEN_ACCOUNT = seededPubkey(26).toBase58();
export const PUMP_PROTOCOL_FEE_RECIPIENT = seededPubkey(27).toBase58();
export const PUMP_ADMIN = seededPubkey(28).toBase58();
export const PUMP_POOL_CREATOR = seededPubkey(29).toBase58();
export const PUMP_COIN_CREATOR = seededPubkey(30).toBase58();
export const PUMP_CORE_FEE_RECIPIENT = seededPubkey(31).toBase58();

export const pumpAmmGlobalConfig: GlobalConfig = {
  admin: new PublicKey(PUMP_ADMIN),
  lpFeeBasisPoints: new BN(125),
  protocolFeeBasisPoints: new BN(45),
  disableFlags: 0,
  protocolFeeRecipients: [new PublicKey(PUMP_PROTOCOL_FEE_RECIPIENT)],
  coinCreatorFeeBasisPoints: new BN(30),
  adminSetCoinCreatorAuthority: seededPubkey(32),
  whitelistPda: seededPubkey(33),
  reservedFeeRecipient: seededPubkey(34),
  mayhemModeEnabled: false,
  reservedFeeRecipients: [seededPubkey(35)],
};

export const pumpAmmFeeConfig: PumpAmmFeeConfig = {
  admin: seededPubkey(36),
  flatFees: {
    lpFeeBps: new BN(140),
    protocolFeeBps: new BN(55),
    creatorFeeBps: new BN(35),
  },
  feeTiers: [
    {
      marketCapLamportsThreshold: new BN('1000000'),
      fees: {
        lpFeeBps: new BN(120),
        protocolFeeBps: new BN(50),
        creatorFeeBps: new BN(25),
      },
    },
    {
      marketCapLamportsThreshold: new BN('1000000000000'),
      fees: {
        lpFeeBps: new BN(110),
        protocolFeeBps: new BN(40),
        creatorFeeBps: new BN(20),
      },
    },
  ],
};

export const pumpAmmPool: Pool = {
  poolBump: 254,
  index: 0,
  creator: new PublicKey(PUMP_POOL_CREATOR),
  baseMint: new PublicKey(PUMP_BASE_MINT),
  quoteMint: new PublicKey(PUMP_QUOTE_MINT),
  lpMint: new PublicKey(PUMP_LP_MINT),
  poolBaseTokenAccount: new PublicKey(PUMP_POOL_BASE_TOKEN_ACCOUNT),
  poolQuoteTokenAccount: new PublicKey(PUMP_POOL_QUOTE_TOKEN_ACCOUNT),
  lpSupply: new BN('5000000000'),
  coinCreator: new PublicKey(PUMP_COIN_CREATOR),
  isMayhemMode: false,
  isCashbackCoin: false,
};

export const pumpCoreGlobal: Global = {
  initialized: true,
  authority: seededPubkey(41),
  feeRecipient: new PublicKey(PUMP_CORE_FEE_RECIPIENT),
  initialVirtualTokenReserves: new BN('1000000000000'),
  initialVirtualSolReserves: new BN('500000000000'),
  initialRealTokenReserves: new BN('800000000000'),
  tokenTotalSupply: new BN('1000000000000'),
  feeBasisPoints: new BN(100),
  withdrawAuthority: seededPubkey(42),
  enableMigrate: true,
  poolMigrationFee: new BN(0),
  creatorFeeBasisPoints: new BN(25),
  feeRecipients: [seededPubkey(43)],
  setCreatorAuthority: seededPubkey(44),
  adminSetCreatorAuthority: seededPubkey(45),
  createV2Enabled: true,
  whitelistPda: seededPubkey(46),
  reservedFeeRecipient: seededPubkey(47),
  mayhemModeEnabled: false,
  reservedFeeRecipients: [seededPubkey(48)],
};

export const pumpCoreBondingCurve: BondingCurve = {
  virtualTokenReserves: new BN('1000000000000'),
  virtualSolReserves: new BN('500000000000'),
  realTokenReserves: new BN('800000000000'),
  realSolReserves: new BN('250000000000'),
  tokenTotalSupply: new BN('1000000000000'),
  complete: false,
  creator: new PublicKey(PUMP_COIN_CREATOR),
  isMayhemMode: false,
  isCashbackCoin: false,
};

export const pumpCoreFeeConfig: PumpCoreFeeConfig = {
  admin: seededPubkey(49),
  flatFees: {
    lpFeeBps: new BN(0),
    protocolFeeBps: new BN(100),
    creatorFeeBps: new BN(25),
  },
  feeTiers: [],
};

export function getPumpWalletAta(mint: string): string {
  return getAssociatedTokenAddressSync(new PublicKey(mint), getTestWallet(), false, TOKEN_PROGRAM_ID).toBase58();
}

export function buildPumpAmmConnection() {
  const connection = new StaticAccountConnection();
  connection.setRawAccount(
    PUMP_POOL,
    PUMP_AMM_PROGRAM_ID.toBase58(),
    Buffer.from(encodePumpAmmAccount('pool', pumpAmmPool)),
  );
  connection.setRawAccount(
    GLOBAL_CONFIG_PDA.toBase58(),
    PUMP_AMM_PROGRAM_ID.toBase58(),
    Buffer.from(encodePumpAmmAccount('globalConfig', pumpAmmGlobalConfig)),
  );
  connection.setRawAccount(
    pumpAmmGlobalConfig.protocolFeeRecipients[0].toBase58(),
    '11111111111111111111111111111111',
  );
  connection.setRawAccount(
    OFFLINE_PUMP_AMM_PROGRAM.programId.toBase58(),
    'BPFLoaderUpgradeab1e11111111111111111111111',
  );
  connection.setRawAccount(
    PUMP_BASE_MINT,
    TOKEN_PROGRAM_ID.toBase58(),
    encodeMintAccount({
      mintAuthority: seededPubkey(61),
      supply: 5_000_000_000_000n,
      decimals: 6,
    }),
  );
  connection.setRawAccount(
    PUMP_QUOTE_MINT,
    TOKEN_PROGRAM_ID.toBase58(),
    encodeMintAccount({
      mintAuthority: seededPubkey(62),
      supply: 9_000_000_000_000n,
      decimals: 6,
    }),
  );
  connection.setRawAccount(
    PUMP_POOL_BASE_TOKEN_ACCOUNT,
    TOKEN_PROGRAM_ID.toBase58(),
    encodeTokenAccount({
      mint: new PublicKey(PUMP_BASE_MINT),
      owner: new PublicKey(PUMP_POOL),
      amount: 2_500_000_000n,
    }),
  );
  connection.setRawAccount(
    PUMP_POOL_QUOTE_TOKEN_ACCOUNT,
    TOKEN_PROGRAM_ID.toBase58(),
    encodeTokenAccount({
      mint: new PublicKey(PUMP_QUOTE_MINT),
      owner: new PublicKey(PUMP_POOL),
      amount: 1_400_000_000n,
    }),
  );

  const feeConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config'), PUMP_AMM_PROGRAM_ID.toBuffer()],
    PUMP_FEE_PROGRAM_ID,
  )[0];
  connection.setRawAccount(
    feeConfigPda.toBase58(),
    PUMP_FEE_PROGRAM_ID.toBase58(),
    Buffer.from(encodePumpAmmAccount('feeConfig', pumpAmmFeeConfig)),
  );

  return { connection, feeConfigPda: feeConfigPda.toBase58() };
}

export function buildPumpCoreConnection() {
  const connection = new StaticAccountConnection();
  connection.setRawAccount(
    GLOBAL_PDA.toBase58(),
    PUMP_PROGRAM_ID.toBase58(),
    Buffer.from(encodePumpCoreAccount('global', pumpCoreGlobal)),
  );
  connection.setRawAccount(
    bondingCurvePda(new PublicKey(PUMP_BASE_MINT)).toBase58(),
    PUMP_PROGRAM_ID.toBase58(),
    Buffer.from(encodePumpCoreAccount('bondingCurve', pumpCoreBondingCurve)),
  );
  connection.setRawAccount(
    PUMP_BASE_MINT,
    TOKEN_PROGRAM_ID.toBase58(),
    encodeMintAccount({
      mintAuthority: seededPubkey(63),
      supply: 1_000_000_000_000n,
      decimals: 6,
    }),
  );

  return connection;
}

export function buildPumpAmmBuyViewInput() {
  return {
    base_mint: PUMP_BASE_MINT,
    quote_mint: PUMP_QUOTE_MINT,
    quote_amount_in: '2500000',
    track_volume: false,
    pool: PUMP_POOL,
    slippage_bps: '125',
  };
}

export function buildPumpAmmSellViewInput() {
  return {
    base_mint: PUMP_BASE_MINT,
    quote_mint: PUMP_QUOTE_MINT,
    pool: PUMP_POOL,
    base_amount_in: '1750000',
    min_quote_amount_out: '1',
  };
}

export function buildPumpCoreViewInput() {
  return {
    base_mint: PUMP_BASE_MINT,
    spendable_sol_in: '3500000',
    slippage_bps: '150',
    track_volume: false,
  };
}

export function expectedPumpAmmAccounts() {
  const protocolFeeRecipient = pumpAmmGlobalConfig.protocolFeeRecipients[0];
  return {
    globalConfig: GLOBAL_CONFIG_PDA.toBase58(),
    userBaseTokenAccount: getPumpWalletAta(PUMP_BASE_MINT),
    userQuoteTokenAccount: getPumpWalletAta(PUMP_QUOTE_MINT),
    protocolFeeRecipient: protocolFeeRecipient.toBase58(),
    protocolFeeRecipientTokenAccount: getAssociatedTokenAddressSync(
      new PublicKey(PUMP_QUOTE_MINT),
      protocolFeeRecipient,
      false,
      TOKEN_PROGRAM_ID,
    ).toBase58(),
    coinCreatorVaultAuthority: coinCreatorVaultAuthorityPda(new PublicKey(PUMP_COIN_CREATOR)).toBase58(),
    coinCreatorVaultAta: coinCreatorVaultAtaPda(
      new PublicKey(PUMP_COIN_CREATOR),
      new PublicKey(PUMP_QUOTE_MINT),
    ).toBase58(),
    poolV2: poolV2Pda(new PublicKey(PUMP_BASE_MINT)).toBase58(),
  };
}

export function expectedPumpCoreAccounts() {
  return {
    global: GLOBAL_PDA.toBase58(),
    bondingCurve: bondingCurvePda(new PublicKey(PUMP_BASE_MINT)).toBase58(),
    bondingCurveV2: bondingCurveV2Pda(new PublicKey(PUMP_BASE_MINT)).toBase58(),
    associatedBondingCurve: getAssociatedTokenAddressSync(
      new PublicKey(PUMP_BASE_MINT),
      bondingCurvePda(new PublicKey(PUMP_BASE_MINT)),
      true,
      TOKEN_PROGRAM_ID,
    ).toBase58(),
    associatedUser: getPumpWalletAta(PUMP_BASE_MINT),
    creatorVault: creatorVaultPda(new PublicKey(PUMP_COIN_CREATOR)).toBase58(),
    feeRecipient: pumpCoreGlobal.feeRecipient.toBase58(),
  };
}

export function expectedPumpAmmBuyQuote() {
  return buyQuoteInput({
    quote: new BN(buildPumpAmmBuyViewInput().quote_amount_in),
    slippage: Number(buildPumpAmmBuyViewInput().slippage_bps),
    baseReserve: new BN('2500000000'),
    quoteReserve: new BN('1400000000'),
    globalConfig: pumpAmmGlobalConfig,
    baseMintAccount: {
      mintAuthorityOption: 1,
      mintAuthority: seededPubkey(61),
      supply: BigInt('5000000000000'),
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
      tlvData: Buffer.alloc(0),
    },
    baseMint: new PublicKey(PUMP_BASE_MINT),
    coinCreator: new PublicKey(PUMP_COIN_CREATOR),
    creator: new PublicKey(PUMP_POOL_CREATOR),
    feeConfig: pumpAmmFeeConfig,
  });
}

export function expectedPumpAmmSellQuote() {
  return sellBaseInput({
    base: new BN(buildPumpAmmSellViewInput().base_amount_in),
    slippage: 0,
    baseReserve: new BN('2500000000'),
    quoteReserve: new BN('1400000000'),
    globalConfig: pumpAmmGlobalConfig,
    baseMintAccount: {
      mintAuthorityOption: 1,
      mintAuthority: seededPubkey(61),
      supply: BigInt('5000000000000'),
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
      tlvData: Buffer.alloc(0),
    },
    baseMint: new PublicKey(PUMP_BASE_MINT),
    coinCreator: new PublicKey(PUMP_COIN_CREATOR),
    creator: new PublicKey(PUMP_POOL_CREATOR),
    feeConfig: pumpAmmFeeConfig,
  });
}

export function expectedPumpCoreQuote() {
  const input = buildPumpCoreViewInput();
  const estimatedOut = getBuyTokenAmountFromSolAmount({
    global: pumpCoreGlobal,
    feeConfig: pumpCoreFeeConfig,
    mintSupply: pumpCoreGlobal.tokenTotalSupply,
    bondingCurve: pumpCoreBondingCurve,
    amount: new BN(input.spendable_sol_in),
  });
  const minTokensOut = estimatedOut.mul(new BN(10000 - Number(input.slippage_bps))).div(new BN(10000));
  return {
    estimatedOut,
    minTokensOut,
  };
}

export function toPumpAmmSdkBuyAccounts(accounts: Record<string, string>) {
  const expected = expectedPumpAmmAccounts();
  return {
    pool: new PublicKey(accounts.pool),
    user: getTestWallet(),
    globalConfig: new PublicKey(accounts.global_config),
    baseMint: new PublicKey(accounts.base_mint),
    quoteMint: new PublicKey(accounts.quote_mint),
    userBaseTokenAccount: new PublicKey(accounts.user_base_token_account),
    userQuoteTokenAccount: new PublicKey(accounts.user_quote_token_account),
    poolBaseTokenAccount: new PublicKey(accounts.pool_base_token_account),
    poolQuoteTokenAccount: new PublicKey(accounts.pool_quote_token_account),
    protocolFeeRecipient: new PublicKey(accounts.protocol_fee_recipient),
    protocolFeeRecipientTokenAccount: new PublicKey(expected.protocolFeeRecipientTokenAccount),
    baseTokenProgram: new PublicKey(accounts.base_token_program),
    quoteTokenProgram: new PublicKey(accounts.quote_token_program),
    systemProgram: SystemProgram.programId,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    eventAuthority: PUMP_AMM_EVENT_AUTHORITY_PDA,
    program: PUMP_AMM_PROGRAM_ID,
    coinCreatorVaultAta: new PublicKey(expected.coinCreatorVaultAta),
    coinCreatorVaultAuthority: new PublicKey(accounts.coin_creator_vault_authority),
  };
}

export function toPumpCoreSdkBuyAccounts(accounts: Record<string, string>) {
  const expected = expectedPumpCoreAccounts();
  return {
    feeRecipient: new PublicKey(accounts.fee_recipient),
    mint: new PublicKey(accounts.mint),
    associatedUser: new PublicKey(accounts.associated_user),
    user: getTestWallet(),
    creatorVault: new PublicKey(accounts.creator_vault),
    global: GLOBAL_PDA,
    bondingCurve: new PublicKey(expected.bondingCurve),
    associatedBondingCurve: new PublicKey(expected.associatedBondingCurve),
    eventAuthority: PUMP_EVENT_AUTHORITY_PDA,
    program: PUMP_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  };
}

export { NATIVE_MINT, TOKEN_PROGRAM_ID };
