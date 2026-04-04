import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AMM_V4 } from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from '@solana/web3.js';

export const RAYDIUM_AMM_PROTOCOL_ID = 'raydium-amm-mainnet';
export const RAYDIUM_AMM_PROGRAM = AMM_V4;
export const RAYDIUM_AMM_PROGRAM_ID = AMM_V4.toBase58();
export const OPENBOOK_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyKsJtPX');
export const RAYDIUM_WALLET = new PublicKey('9hSR6S7WPtxmTojgo6GG3k4yDPecgJY292j7xrsUGWBu');
export const BASE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const QUOTE_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

function seededAddress(label: string): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(`raydium:${label}`)], RAYDIUM_AMM_PROGRAM)[0];
}

export const RAYDIUM_AMM_FIXTURE = {
  wallet: RAYDIUM_WALLET,
  tokenProgram: TOKEN_PROGRAM_ID,
  baseMint: BASE_MINT,
  quoteMint: QUOTE_MINT,
  pool: seededAddress('pool'),
  authority: seededAddress('authority'),
  openOrders: seededAddress('open-orders'),
  targetOrders: seededAddress('target-orders'),
  lpMint: seededAddress('lp-mint'),
  baseVault: seededAddress('base-vault'),
  quoteVault: seededAddress('quote-vault'),
  withdrawQueue: seededAddress('withdraw-queue'),
  tempLpTokenAccount: seededAddress('temp-lp-token-account'),
  market: seededAddress('market'),
  marketBaseVault: seededAddress('market-base-vault'),
  marketQuoteVault: seededAddress('market-quote-vault'),
  marketAuthority: seededAddress('market-authority'),
  marketBids: seededAddress('market-bids'),
  marketAsks: seededAddress('market-asks'),
  marketEventQueue: seededAddress('market-event-queue'),
  userBaseTokenAccount: getAssociatedTokenAddressSync(BASE_MINT, RAYDIUM_WALLET, false, TOKEN_PROGRAM_ID),
  userQuoteTokenAccount: getAssociatedTokenAddressSync(QUOTE_MINT, RAYDIUM_WALLET, false, TOKEN_PROGRAM_ID),
  userLpTokenAccount: getAssociatedTokenAddressSync(seededAddress('lp-mint'), RAYDIUM_WALLET, false, TOKEN_PROGRAM_ID),
};

export const RAYDIUM_POOL_INFO = {
  id: RAYDIUM_AMM_FIXTURE.pool.toBase58(),
  programId: RAYDIUM_AMM_PROGRAM_ID,
  marketId: RAYDIUM_AMM_FIXTURE.market.toBase58(),
  lpMint: {
    address: RAYDIUM_AMM_FIXTURE.lpMint.toBase58(),
  },
  pooltype: ['Standard'],
};

export const RAYDIUM_POOL_KEYS = {
  id: RAYDIUM_AMM_FIXTURE.pool,
  programId: RAYDIUM_AMM_PROGRAM,
  authority: RAYDIUM_AMM_FIXTURE.authority,
  openOrders: RAYDIUM_AMM_FIXTURE.openOrders,
  targetOrders: RAYDIUM_AMM_FIXTURE.targetOrders,
  baseVault: RAYDIUM_AMM_FIXTURE.baseVault,
  quoteVault: RAYDIUM_AMM_FIXTURE.quoteVault,
  withdrawQueue: RAYDIUM_AMM_FIXTURE.withdrawQueue,
  lpVault: RAYDIUM_AMM_FIXTURE.tempLpTokenAccount,
  lpMint: RAYDIUM_AMM_FIXTURE.lpMint,
  mintLp: {
    address: RAYDIUM_AMM_FIXTURE.lpMint,
  },
  vault: {
    A: RAYDIUM_AMM_FIXTURE.baseVault,
    B: RAYDIUM_AMM_FIXTURE.quoteVault,
  },
  marketProgramId: OPENBOOK_PROGRAM_ID,
  marketId: RAYDIUM_AMM_FIXTURE.market,
  marketBaseVault: RAYDIUM_AMM_FIXTURE.marketBaseVault,
  marketQuoteVault: RAYDIUM_AMM_FIXTURE.marketQuoteVault,
  marketAuthority: RAYDIUM_AMM_FIXTURE.marketAuthority,
  marketBids: RAYDIUM_AMM_FIXTURE.marketBids,
  marketAsks: RAYDIUM_AMM_FIXTURE.marketAsks,
  marketEventQueue: RAYDIUM_AMM_FIXTURE.marketEventQueue,
};
