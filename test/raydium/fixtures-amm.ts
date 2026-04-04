import BN from 'bn.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getAssociatedPoolKeys } from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from '@solana/web3.js';

export const RAYDIUM_AMM_PROTOCOL_ID = 'raydium-amm-v4-mainnet';
export const RAYDIUM_AMM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const RAYDIUM_AMM_PROGRAM = new PublicKey(RAYDIUM_AMM_PROGRAM_ID);

function seededPublicKey(seed: number): PublicKey {
  return new PublicKey(Uint8Array.from({ length: 32 }, (_, index) => (seed + index) % 256));
}

export const AMM_MARKET_PROGRAM_ID = seededPublicKey(41);
export const AMM_MARKET_ID = seededPublicKey(42);
export const AMM_BASE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const AMM_QUOTE_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const AMM_WALLET = new PublicKey('11111111111111111111111111111111');

export const AMM_POOL_KEYS = getAssociatedPoolKeys({
  version: 4,
  marketVersion: 3,
  marketId: AMM_MARKET_ID,
  baseMint: AMM_BASE_MINT,
  quoteMint: AMM_QUOTE_MINT,
  baseDecimals: 9,
  quoteDecimals: 6,
  programId: RAYDIUM_AMM_PROGRAM,
  marketProgramId: AMM_MARKET_PROGRAM_ID,
});

export const AMM_USER_TOKEN_IN = getAssociatedTokenAddressSync(AMM_BASE_MINT, AMM_WALLET, false, TOKEN_PROGRAM_ID);
export const AMM_USER_TOKEN_OUT = getAssociatedTokenAddressSync(AMM_QUOTE_MINT, AMM_WALLET, false, TOKEN_PROGRAM_ID);

export const AMM_MARKET_BIDS = seededPublicKey(51);
export const AMM_MARKET_ASKS = seededPublicKey(61);
export const AMM_MARKET_EVENT_QUEUE = seededPublicKey(71);
export const AMM_MARKET_BASE_VAULT = seededPublicKey(81);
export const AMM_MARKET_QUOTE_VAULT = seededPublicKey(91);

export const AMM_SWAP_FIXTURE = {
  wallet: AMM_WALLET,
  amountIn: new BN('500000000'),
  minAmountOut: new BN('1000000'),
  marketProgramId: AMM_MARKET_PROGRAM_ID,
  marketId: AMM_MARKET_ID,
  baseMint: AMM_BASE_MINT,
  quoteMint: AMM_QUOTE_MINT,
  poolKeys: AMM_POOL_KEYS,
  userTokenIn: AMM_USER_TOKEN_IN,
  userTokenOut: AMM_USER_TOKEN_OUT,
  marketBids: AMM_MARKET_BIDS,
  marketAsks: AMM_MARKET_ASKS,
  marketEventQueue: AMM_MARKET_EVENT_QUEUE,
  marketBaseVault: AMM_MARKET_BASE_VAULT,
  marketQuoteVault: AMM_MARKET_QUOTE_VAULT,
} as const;
