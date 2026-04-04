import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  initSyncEmbed as initInf1,
  findPoolReservesAta,
  getLstStateList,
  getPoolState,
  initObj as initInfObj,
  initPks,
  serLstStateList,
  serPoolState,
} from '@sanctumso/inf1';
import {
  initSyncEmbed as initRouter,
  depositSolIx,
  depositStakeIx,
  findBridgeStakeAccPda,
  findFeeTokenAccountPda,
  init as initRouterMint,
  newSanctumRouter,
  update as updateRouter,
} from '@sanctumso/sanctum-router';
import {
  defaultStakePool,
  defaultValidatorList,
  depositSolIxFromStakePool,
  findValidatorStakeAccountPda,
  findWithdrawAuthPda,
  initSyncEmbed as initStakePool,
  serStakePool,
  serValidatorList,
  setStakePool,
  setValidatorList,
} from '@sanctumso/spl-stake-pool';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const STAKE_HISTORY_SYSVAR = 'SysvarStakeHistory1111111111111111111111111';
const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const SANCTUM_ROUTER_PROGRAM = 'stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq';
const SANCTUM_INF_PROGRAM = '5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx';
const SANCTUM_FLAT_FEE_PRICING_PROGRAM = 'f1tUoNEKrDp1oeGn4zxr7bh41eN6VcfHjfrL3ZqQday';
const SANCTUM_SPL_SOL_VALUE_CALCULATOR = 'sp1V4h2gWorkGhVcazBc22Hfo2f5sd7jcjT4EDPrWFF';
const SANCTUM_WSOL_SOL_VALUE_CALCULATOR = 'wsoGmxQLSvwWpuaidCApxN5kEowLe2HLQLJhCQnj4bE';
const SANCTUM_SPL_STAKE_POOL_PROGRAM = 'SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY';
const LAINESOL_MINT = 'LAinEtNLgpmCP9Rvsf5Hn8W6EhNiKLZQti1xfWMLy6X';
const LAINESOL_STAKE_POOL = '2qyEeSAWKfU18AFthrF7JA8z8ZCi1yt76Tqs917vwQTV';

const FIXTURE = {
  manager: '11111111111111111111111111111112',
  staker: '11111111111111111111111111111113',
  stakeDepositAuthority: '11111111111111111111111111111114',
  validatorList: '11111111111111111111111111111115',
  reserveStake: '11111111111111111111111111111116',
  poolMint: '11111111111111111111111111111117',
  managerFeeAccount: '11111111111111111111111111111118',
  stakePool: '11111111111111111111111111111119',
  referrerFee: '1111111111111111111111111111111A',
  fromUserLamports: '1111111111111111111111111111111B',
  destUserPool: '1111111111111111111111111111111C',
  wallet: '1111111111111111111111111111111N',
  userLstAta: '1111111111111111111111111111111Q',
  depositStake: '1111111111111111111111111111111K',
  validatorVote: '1111111111111111111111111111111L',
};

function encodeU64Le(value: bigint): Uint8Array {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return new Uint8Array(buffer);
}

function expectUint8Array(actual: Uint8Array, expected: Uint8Array) {
  expect([...actual]).toEqual([...expected]);
}

function buildStakePoolHandle() {
  const handle = defaultStakePool();
  setStakePool(handle, {
    accountType: 'StakePool',
    manager: FIXTURE.manager,
    staker: FIXTURE.staker,
    stakeDepositAuthority: FIXTURE.stakeDepositAuthority,
    stakeWithdrawBumpSeed: 255,
    validatorList: FIXTURE.validatorList,
    reserveStake: FIXTURE.reserveStake,
    poolMint: FIXTURE.poolMint,
    managerFeeAccount: FIXTURE.managerFeeAccount,
    tokenProgramId: TOKEN_PROGRAM,
    totalLamports: 1_000_000_000_000n,
    poolTokenSupply: 1_000_000_000_000n,
    lastUpdateEpoch: 1n,
    lockup: { unixTimestamp: 0n, epoch: 0n, custodian: SYSTEM_PROGRAM },
    epochFee: { denominator: 10_000n, numerator: 0n },
    nextEpochFee: 'None',
    preferredDepositValidatorVoteAddress: undefined,
    preferredWithdrawValidatorVoteAddress: undefined,
    stakeDepositFee: { denominator: 10_000n, numerator: 0n },
    stakeWithdrawalFee: { denominator: 10_000n, numerator: 0n },
    nextStakeWithdrawalFee: 'None',
    stakeReferralFee: 0,
    solDepositAuthority: undefined,
    solDepositFee: { denominator: 10_000n, numerator: 0n },
    solReferralFee: 0,
    solWithdrawAuthority: undefined,
    solWithdrawalFee: { denominator: 10_000n, numerator: 0n },
    nextSolWithdrawalFee: 'None',
    lastEpochPoolTokenSupply: 1_000_000_000_000n,
    lastEpochTotalLamports: 1_000_000_000_000n,
  });
  return handle;
}

function buildValidatorListHandle(includeValidator = false) {
  const handle = defaultValidatorList();
  setValidatorList(handle, {
    header: {
      account_type: 'ValidatorList',
      max_validators: 1,
    },
    validators: includeValidator
      ? [
          {
            activeStakeLamports: 1_000n,
            transientStakeLamports: 0n,
            lastUpdateEpoch: 1n,
            transientSeedSuffix: 0n,
            validatorSeedSuffix: 0,
            status: 'Active',
            voteAccountAddress: FIXTURE.validatorVote,
          },
        ]
      : [],
  });
  return handle;
}

function initDepositSolRouter() {
  const router = newSanctumRouter();
  const stakePool = buildStakePoolHandle();
  initRouterMint(router, [
    {
      mint: FIXTURE.poolMint,
      init: {
        pool: 'spl',
        stakePoolAddr: FIXTURE.stakePool,
        stakePoolProgramAddr: SANCTUM_SPL_STAKE_POOL_PROGRAM,
        validatorListAddr: FIXTURE.validatorList,
        reserveStakeAddr: FIXTURE.reserveStake,
      },
    },
  ]);
  updateRouter(
    router,
    [{ swap: 'depositSol', out: FIXTURE.poolMint }],
    new Map([
      [
        FIXTURE.stakePool,
        {
          owner: SANCTUM_SPL_STAKE_POOL_PROGRAM,
          data: serStakePool(stakePool),
          lamports: 1n,
        },
      ],
      [
        CLOCK_SYSVAR,
        {
          owner: 'Sysvar1111111111111111111111111111111111111',
          data: new Uint8Array(40),
          lamports: 1n,
        },
      ],
    ]),
  );
  return router;
}

function initDepositStakeRouter() {
  const router = newSanctumRouter();
  const stakePool = buildStakePoolHandle();
  const validatorList = buildValidatorListHandle(true);
  initRouterMint(router, [
    {
      mint: FIXTURE.poolMint,
      init: {
        pool: 'spl',
        stakePoolAddr: FIXTURE.stakePool,
        stakePoolProgramAddr: SANCTUM_SPL_STAKE_POOL_PROGRAM,
        validatorListAddr: FIXTURE.validatorList,
        reserveStakeAddr: FIXTURE.reserveStake,
      },
    },
  ]);
  updateRouter(
    router,
    [{ swap: 'depositStake', out: FIXTURE.poolMint }],
    new Map([
      [
        FIXTURE.stakePool,
        {
          owner: SANCTUM_SPL_STAKE_POOL_PROGRAM,
          data: serStakePool(stakePool),
          lamports: 1n,
        },
      ],
      [
        FIXTURE.validatorList,
        {
          owner: SANCTUM_SPL_STAKE_POOL_PROGRAM,
          data: serValidatorList(validatorList),
          lamports: 1n,
        },
      ],
      [
        CLOCK_SYSVAR,
        {
          owner: 'Sysvar1111111111111111111111111111111111111',
          data: new Uint8Array(40),
          lamports: 1n,
        },
      ],
    ]),
  );
  return router;
}

initStakePool();
initRouter();
initInf1();

describe('Sanctum LST conformance', () => {
  it('encodes spl stake-pool deposit SOL exactly', () => {
    const ix = depositSolIxFromStakePool(
      {
        program: SANCTUM_SPL_STAKE_POOL_PROGRAM,
        stakePool: FIXTURE.stakePool,
        referrerFee: FIXTURE.referrerFee,
        fromUserLamports: FIXTURE.fromUserLamports,
        destUserPool: FIXTURE.destUserPool,
      },
      buildStakePoolHandle(),
      { depositLamports: 123n },
    );

    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);

    expect(ix.programAddress).toBe(SANCTUM_SPL_STAKE_POOL_PROGRAM);
    expectUint8Array(ix.data, Uint8Array.of(14, ...encodeU64Le(123n)));
    expect(ix.accounts.map((account) => account.address)).toEqual([
      FIXTURE.stakePool,
      withdrawAuthority,
      FIXTURE.reserveStake,
      FIXTURE.fromUserLamports,
      FIXTURE.destUserPool,
      FIXTURE.managerFeeAccount,
      FIXTURE.referrerFee,
      FIXTURE.poolMint,
      SYSTEM_PROGRAM,
      TOKEN_PROGRAM,
    ]);
  });

  it('builds router depositSolIx with fee PDA and stake-pool accounts', () => {
    const ix = depositSolIx(initDepositSolRouter(), {
      amt: 123n,
      out: FIXTURE.poolMint,
      signerInp: FIXTURE.wallet,
      signerOut: FIXTURE.userLstAta,
      signer: FIXTURE.wallet,
    });

    const [feeTokenPda] = findFeeTokenAccountPda(FIXTURE.poolMint);
    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);

    expect(ix.programAddress).toBe(SANCTUM_ROUTER_PROGRAM);
    expectUint8Array(ix.data, Uint8Array.of(0, ...encodeU64Le(123n)));
    expect(ix.accounts[0]).toEqual({ address: FIXTURE.wallet, role: 2 });
    expect(ix.accounts[1]).toEqual({ address: FIXTURE.wallet, role: 1 });
    expect(ix.accounts[2]).toEqual({ address: FIXTURE.userLstAta, role: 1 });
    expect(ix.accounts[5]).toEqual({ address: feeTokenPda, role: 1 });
    expect(ix.accounts.map((account) => account.address)).toContain(WSOL_MINT);
    expect(ix.accounts.map((account) => account.address)).toContain(SANCTUM_SPL_STAKE_POOL_PROGRAM);
    expect(ix.accounts.map((account) => account.address)).toContain(FIXTURE.stakePool);
    expect(ix.accounts.map((account) => account.address)).toContain(withdrawAuthority);
    expect(ix.accounts.map((account) => account.address)).toContain(FIXTURE.reserveStake);
    expect(ix.accounts.at(-1)?.address).toBe(FIXTURE.managerFeeAccount);
  });

  it('builds router depositStakeIx with the canonical validator stake PDA', () => {
    const ix = depositStakeIx(initDepositStakeRouter(), {
      inp: FIXTURE.validatorVote,
      out: FIXTURE.poolMint,
      signerInp: FIXTURE.depositStake,
      signerOut: FIXTURE.userLstAta,
      signer: FIXTURE.wallet,
    });

    const [feeTokenPda] = findFeeTokenAccountPda(FIXTURE.poolMint);
    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);
    const [validatorStakePda] = findValidatorStakeAccountPda(
      SANCTUM_SPL_STAKE_POOL_PROGRAM,
      FIXTURE.validatorVote,
      FIXTURE.stakePool,
      0,
    );

    expect(ix.programAddress).toBe(SANCTUM_ROUTER_PROGRAM);
    expectUint8Array(ix.data, Uint8Array.of(5));
    expect(ix.accounts[0]).toEqual({ address: FIXTURE.wallet, role: 3 });
    expect(ix.accounts[3]).toEqual({ address: feeTokenPda, role: 1 });
    expect(ix.accounts[8]).toEqual({ address: FIXTURE.stakeDepositAuthority, role: 0 });
    expect(ix.accounts[9]).toEqual({ address: withdrawAuthority, role: 0 });
    expect(ix.accounts[10]).toEqual({ address: validatorStakePda, role: 1 });
    expect(ix.accounts.map((account) => account.address)).toContain(STAKE_HISTORY_SYSVAR);
    expect(ix.accounts.map((account) => account.address)).toContain(STAKE_PROGRAM);
  });

  it('derives bridge stake and fee token PDAs from the router seeds', () => {
    const routerProgram = new PublicKey(SANCTUM_ROUTER_PROGRAM);
    const wallet = new PublicKey(FIXTURE.wallet);
    const mint = new PublicKey(FIXTURE.poolMint);
    const bridgeStakeSeed = Buffer.alloc(4);
    bridgeStakeSeed.writeUInt32LE(7, 0);

    const [manualBridgeStake] = PublicKey.findProgramAddressSync(
      [Buffer.from('bridge_stake'), wallet.toBuffer(), bridgeStakeSeed],
      routerProgram,
    );
    const [manualFeeToken] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee'), mint.toBuffer()],
      routerProgram,
    );

    expect(findBridgeStakeAccPda(FIXTURE.wallet, 7)).toEqual([manualBridgeStake.toBase58(), 255]);
    expect(findFeeTokenAccountPda(FIXTURE.poolMint)).toEqual([manualFeeToken.toBase58(), 254]);
  });

  it('derives Infinity state PDAs and pool reserves ATA from official program seeds', () => {
    const infProgram = new PublicKey(SANCTUM_INF_PROGRAM);
    const [manualStatePda] = PublicKey.findProgramAddressSync([Buffer.from('state')], infProgram);
    const [manualLstStateListPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('lst-state-list')],
      infProgram,
    );
    const manualPoolReservesAta = getAssociatedTokenAddressSync(
      new PublicKey(WSOL_MINT),
      manualStatePda,
      true,
    );

    expect(initPks()).toEqual([manualStatePda.toBase58(), manualLstStateListPda.toBase58()]);
    expect(findPoolReservesAta(WSOL_MINT)).toEqual([manualPoolReservesAta.toBase58(), 255]);
  });

  it('parses Infinity pool state and lst state lists from initObj state', () => {
    const inf = initInfObj(
      {
        totalSolValue: 1_000_000_000n,
        protocolFeeNanos: 0,
        version: 2,
        isDisabled: 0,
        isRebalancing: 0,
        admin: SYSTEM_PROGRAM,
        rebalanceAuthority: FIXTURE.manager,
        protocolFeeBeneficiary: FIXTURE.staker,
        pricingProgram: SANCTUM_FLAT_FEE_PRICING_PROGRAM,
        lpTokenMint: FIXTURE.validatorList,
        rpsAuthority: FIXTURE.reserveStake,
        rps: 0n,
        withheldLamports: 0n,
        protocolFeeLamports: 0n,
        lastReleaseSlot: 1n,
      },
      [
        {
          isInputDisabled: 0,
          poolReservesBump: 255,
          protocolFeeAccumulatorBump: 254,
          solValue: 1_000_000_000n,
          mint: WSOL_MINT,
          solValueCalculator: SANCTUM_WSOL_SOL_VALUE_CALCULATOR,
        },
        {
          isInputDisabled: 0,
          poolReservesBump: 254,
          protocolFeeAccumulatorBump: 253,
          solValue: 990_000_000n,
          mint: LAINESOL_MINT,
          solValueCalculator: SANCTUM_SPL_SOL_VALUE_CALCULATOR,
        },
      ],
      new Map([[LAINESOL_MINT, LAINESOL_STAKE_POOL]]),
    );

    const poolState = getPoolState(inf);
    const lstStates = getLstStateList(inf);

    expect(poolState.pricingProgram).toBe(SANCTUM_FLAT_FEE_PRICING_PROGRAM);
    expect(poolState.version).toBe(2);
    expect(lstStates).toHaveLength(2);
    expect(lstStates[0]?.solValueCalculator).toBe(SANCTUM_WSOL_SOL_VALUE_CALCULATOR);
    expect(lstStates[1]?.mint).toBe(LAINESOL_MINT);
    expect(serPoolState(inf)).toHaveLength(240);
    expect(serLstStateList(inf)).toHaveLength(160);
  });
});
