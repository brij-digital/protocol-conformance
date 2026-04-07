import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN, Marinade, MarinadeConfig, MarinadeState } from '@marinade.finance/marinade-ts-sdk';
import { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

export const MARINADE_PROTOCOL_ID = 'marinade-mainnet';
export const MARINADE_PROGRAM_ID = 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD';
export const MARINADE_PROGRAM = new PublicKey(MARINADE_PROGRAM_ID);
export const MARINADE_STATE_ADDRESS = new PublicKey('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC');
export const MARINADE_MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
export const MARINADE_LIQ_POOL_MSOL_LEG = new PublicKey('UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q');
export const MARINADE_TREASURY_MSOL_ACCOUNT = new PublicKey('B1aLzaNMeFVAyQ6f3XbbUyKcH2YPHu2fqiEagmiF23VR');
export const TEST_WALLET = Keypair.generate().publicKey;
export const TEST_TICKET_ACCOUNT = Keypair.generate().publicKey;
export const TEST_VALIDATOR_VOTE = Keypair.generate().publicKey;
export const TICKET_ACCOUNT_RENT_LAMPORTS = 1_234_560;

function deriveStatePda(seed: string, extraSeeds: Buffer[] = []): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARINADE_STATE_ADDRESS.toBuffer(), Buffer.from(seed), ...extraSeeds],
    MARINADE_PROGRAM,
  );
}

function publicKey(): PublicKey {
  return Keypair.generate().publicKey;
}

const [, reserveBumpSeed] = deriveStatePda('reserve');
const [, msolMintAuthorityBumpSeed] = deriveStatePda('st_mint');
const [, liqPoolMsolLegAuthorityBumpSeed] = deriveStatePda('liq_st_sol_authority');
const [, lpMintAuthorityBumpSeed] = deriveStatePda('liq_mint');
const [, liqPoolSolLegBumpSeed] = deriveStatePda('liq_sol');
const [, stakeDepositBumpSeed] = deriveStatePda('deposit');
const [, stakeWithdrawBumpSeed] = deriveStatePda('withdraw');

const MARINADE_STATE_DATA = {
  msolMint: MARINADE_MSOL_MINT,
  adminAuthority: publicKey(),
  operationalSolAccount: publicKey(),
  treasuryMsolAccount: MARINADE_TREASURY_MSOL_ACCOUNT,
  reserveBumpSeed,
  msolMintAuthorityBumpSeed,
  rentExemptForTokenAcc: new BN(2_039_280),
  rewardFee: { basisPoints: 300 },
  stakeSystem: {
    stakeList: {
      account: publicKey(),
      itemSize: 0,
      count: 0,
      reserved1: SystemProgram.programId,
      reserved2: 0,
    },
    delayedUnstakeCoolingDown: new BN(0),
    stakeDepositBumpSeed,
    stakeWithdrawBumpSeed,
    slotsForStakeDelta: new BN(216_000),
    lastStakeDeltaEpoch: new BN(0),
    minStake: new BN(1_000_000_000),
    extraStakeDeltaRuns: 0,
  },
  validatorSystem: {
    validatorList: {
      account: publicKey(),
      itemSize: 0,
      count: 0,
      reserved1: SystemProgram.programId,
      reserved2: 0,
    },
    managerAuthority: publicKey(),
    totalValidatorScore: 0,
    totalActiveBalance: new BN(0),
    autoAddValidatorEnabled: 0,
  },
  liqPool: {
    lpMint: publicKey(),
    lpMintAuthorityBumpSeed,
    solLegBumpSeed: liqPoolSolLegBumpSeed,
    msolLegAuthorityBumpSeed: liqPoolMsolLegAuthorityBumpSeed,
    msolLeg: MARINADE_LIQ_POOL_MSOL_LEG,
    lpLiquidityTarget: new BN(0),
    lpMaxFee: { basisPoints: 300 },
    lpMinFee: { basisPoints: 30 },
    treasuryCut: { basisPoints: 2_500 },
    lpSupply: new BN(0),
    lentFromSolLeg: new BN(0),
    liquiditySolCap: new BN('18446744073709551615'),
  },
  availableReserveBalance: new BN(0),
  msolSupply: new BN(0),
  msolPrice: new BN(4_294_967_296),
  circulatingTicketCount: new BN(0),
  circulatingTicketBalance: new BN(0),
  lentFromReserve: new BN(0),
  minDeposit: new BN(1_000_000_000),
  minWithdraw: new BN(1_000_000_000),
  stakingSolCap: new BN('18446744073709551615'),
  emergencyCoolingDown: new BN(0),
  pauseAuthority: publicKey(),
  paused: false,
  delayedUnstakeFee: { bpCents: 0 },
  withdrawStakeAccountFee: { bpCents: 0 },
  withdrawStakeAccountEnabled: true,
  lastStakeMoveEpoch: new BN(0),
  stakeMoved: new BN(0),
  maxStakeMovedPerEpoch: { basisPoints: 9_500 },
};

const encoderMarinade = new Marinade(
  new MarinadeConfig({
    connection: {} as never,
    publicKey: TEST_WALLET,
    marinadeFinanceProgramId: MARINADE_PROGRAM,
    marinadeStateAddress: MARINADE_STATE_ADDRESS,
  }),
);

const MARINADE_STATE_ACCOUNT_DATA = Buffer.from(
  await encoderMarinade.marinadeFinanceProgram.program.coder.accounts.encode('state', MARINADE_STATE_DATA),
);

class OfflineMarinadeConnection {
  async getAccountInfo(address: PublicKey | string) {
    const key = typeof address === 'string' ? address : address.toBase58();
    if (key === MARINADE_STATE_ADDRESS.toBase58()) {
      return {
        data: MARINADE_STATE_ACCOUNT_DATA,
        owner: MARINADE_PROGRAM,
        executable: false,
        lamports: 0,
        rentEpoch: 0,
      };
    }
    return null;
  }

  async getAccountInfoAndContext(address: PublicKey | string) {
    return {
      context: { slot: 0 },
      value: await this.getAccountInfo(address),
    };
  }

  async getTokenAccountsByOwner() {
    return {
      context: { slot: 0 },
      value: [],
    };
  }

  async getMinimumBalanceForRentExemption() {
    return TICKET_ACCOUNT_RENT_LAMPORTS;
  }
}

export const MARINADE_FIXTURE = {
  wallet: TEST_WALLET,
  state: MARINADE_STATE_ADDRESS,
  msolMint: MARINADE_MSOL_MINT,
  reservePda: deriveStatePda('reserve')[0],
  msolMintAuthority: deriveStatePda('st_mint')[0],
  liqPoolMsolLegAuthority: deriveStatePda('liq_st_sol_authority')[0],
  liqPoolSolLegPda: deriveStatePda('liq_sol')[0],
  stakeDepositAuthority: deriveStatePda('deposit')[0],
  stakeWithdrawAuthority: deriveStatePda('withdraw')[0],
  validatorDuplicationFlag: deriveStatePda('unique_validator', [TEST_VALIDATOR_VOTE.toBuffer()])[0],
  liqPoolMsolLeg: MARINADE_STATE_DATA.liqPool.msolLeg,
  treasuryMsolAccount: MARINADE_STATE_DATA.treasuryMsolAccount,
  msolTokenAccount: getAssociatedTokenAddressSync(MARINADE_MSOL_MINT, TEST_WALLET),
  ticketAccount: TEST_TICKET_ACCOUNT,
  validatorVote: TEST_VALIDATOR_VOTE,
  clock: SYSVAR_CLOCK_PUBKEY,
  rent: SYSVAR_RENT_PUBKEY,
  tokenProgram: TOKEN_PROGRAM_ID,
};

export async function buildOfflineMarinade() {
  const connection = new OfflineMarinadeConnection();
  const marinade = new Marinade(
    new MarinadeConfig({
      connection: connection as never,
      publicKey: MARINADE_FIXTURE.wallet,
      marinadeFinanceProgramId: MARINADE_PROGRAM,
      marinadeStateAddress: MARINADE_STATE_ADDRESS,
    }),
  );

  return {
    connection,
    marinade,
    marinadeState: await MarinadeState.fetch(marinade),
  };
}
