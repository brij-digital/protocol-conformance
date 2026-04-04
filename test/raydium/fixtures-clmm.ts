import BN from 'bn.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  getPdaExBitmapAccount,
  getPdaObservationAccount,
  getPdaPoolId,
  getPdaPoolVaultId,
  getPdaTickArrayAddress,
} from '@raydium-io/raydium-sdk-v2';
import { PublicKey } from '@solana/web3.js';

export const RAYDIUM_CLMM_PROTOCOL_ID = 'raydium-clmm-mainnet';
export const RAYDIUM_CLMM_PROGRAM_ID = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
export const RAYDIUM_CLMM_PROGRAM = new PublicKey(RAYDIUM_CLMM_PROGRAM_ID);

export const CLMM_WALLET = new PublicKey('11111111111111111111111111111111');
export const CLMM_AMM_CONFIG = new PublicKey('D4FPEruKEHrG5TenqFjZVT4qVaki3P6KyHRxY6SY3nPd');
export const CLMM_MINT_A = new PublicKey('So11111111111111111111111111111111111111112');
export const CLMM_MINT_B = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export const CLMM_POOL_ID = getPdaPoolId(
  RAYDIUM_CLMM_PROGRAM,
  CLMM_AMM_CONFIG,
  CLMM_MINT_A,
  CLMM_MINT_B,
).publicKey;
export const CLMM_VAULT_A = getPdaPoolVaultId(RAYDIUM_CLMM_PROGRAM, CLMM_POOL_ID, CLMM_MINT_A).publicKey;
export const CLMM_VAULT_B = getPdaPoolVaultId(RAYDIUM_CLMM_PROGRAM, CLMM_POOL_ID, CLMM_MINT_B).publicKey;
export const CLMM_OBSERVATION_ID = getPdaObservationAccount(RAYDIUM_CLMM_PROGRAM, CLMM_POOL_ID).publicKey;
export const CLMM_EX_BITMAP = getPdaExBitmapAccount(RAYDIUM_CLMM_PROGRAM, CLMM_POOL_ID).publicKey;

export const CLMM_TICK_ARRAYS = [-120, -60, 0].map((startIndex) =>
  getPdaTickArrayAddress(RAYDIUM_CLMM_PROGRAM, CLMM_POOL_ID, startIndex).publicKey,
);

export const CLMM_USER_TOKEN_A = getAssociatedTokenAddressSync(CLMM_MINT_A, CLMM_WALLET, false, TOKEN_PROGRAM_ID);
export const CLMM_USER_TOKEN_B = getAssociatedTokenAddressSync(CLMM_MINT_B, CLMM_WALLET, false, TOKEN_PROGRAM_ID);

export const CLMM_POOL_INFO = {
  id: CLMM_POOL_ID.toBase58(),
  programId: RAYDIUM_CLMM_PROGRAM_ID,
  mintA: { address: CLMM_MINT_A.toBase58() },
  mintB: { address: CLMM_MINT_B.toBase58() },
  config: { id: CLMM_AMM_CONFIG.toBase58() },
} as const;

export const CLMM_POOL_KEYS = {
  vault: {
    A: CLMM_VAULT_A.toBase58(),
    B: CLMM_VAULT_B.toBase58(),
  },
} as const;

export const CLMM_SWAP_FIXTURE = {
  amountIn: new BN('2500000'),
  amountOutMin: new BN('1200000'),
  sqrtPriceLimitX64: new BN('79226673515401279992447579055'),
  wallet: CLMM_WALLET,
  ammConfig: CLMM_AMM_CONFIG,
  mintA: CLMM_MINT_A,
  mintB: CLMM_MINT_B,
  poolId: CLMM_POOL_ID,
  vaultA: CLMM_VAULT_A,
  vaultB: CLMM_VAULT_B,
  observationId: CLMM_OBSERVATION_ID,
  exBitmap: CLMM_EX_BITMAP,
  tickArrays: CLMM_TICK_ARRAYS,
  userTokenA: CLMM_USER_TOKEN_A,
  userTokenB: CLMM_USER_TOKEN_B,
  poolInfo: CLMM_POOL_INFO,
  poolKeys: CLMM_POOL_KEYS,
} as const;
