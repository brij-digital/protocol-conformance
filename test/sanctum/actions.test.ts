import { prepareRuntimeInstruction, previewIdlInstruction } from '@brij-digital/apppack-runtime';
import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  initSyncEmbed as initRouter,
  createSlumdogStakeAddr,
  depositSolIx,
  depositStakeIx,
  findBridgeStakeAccPda,
  findFeeTokenAccountPda,
  init as initRouterMint,
  newSanctumRouter,
  prefundSwapViaStakeIx,
  update as updateRouter,
  withdrawSolIx,
} from '@sanctumso/sanctum-router';
import {
  defaultStakePool,
  defaultValidatorList,
  findValidatorStakeAccountPda,
  findWithdrawAuthPda,
  initSyncEmbed as initStakePool,
  serStakePool,
  serValidatorList,
  setStakePool,
  setValidatorList,
} from '@sanctumso/spl-stake-pool';
import '../../src/support/runtime.js';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const STAKE_HISTORY_SYSVAR = 'SysvarStakeHistory1111111111111111111111111';
const CLOCK_SYSVAR = 'SysvarC1ock11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const SANCTUM_PROGRAM_ID = 'stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq';
const SANCTUM_SPL_STAKE_POOL_PROGRAM = 'SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY';
const SANCTUM_PROTOCOL_ID = 'sanctum-mainnet';

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
  wallet: '1111111111111111111111111111111N',
  userLstAta: '1111111111111111111111111111111Q',
  userLstAtaOut: '1111111111111111111111111111111m',
  depositStake: '1111111111111111111111111111111K',
  validatorVote: '1111111111111111111111111111111L',
  altStakePool: '2qyEeSAWKfU18AFthrF7JA8z8ZCi1yt76Tqs917vwQTV',
  altPoolMint: 'LAinEtNLgpmCP9Rvsf5Hn8W6EhNiKLZQti1xfWMLy6X',
};

function comparableKeys(
  keys: Array<{ pubkey: { toBase58(): string } | string; isSigner: boolean; isWritable: boolean }>,
) {
  return keys.map((entry) => ({
    pubkey: typeof entry.pubkey === 'string' ? entry.pubkey : entry.pubkey.toBase58(),
    isSigner: entry.isSigner,
    isWritable: entry.isWritable,
  }));
}

function buildStakePoolHandle(poolMint = FIXTURE.poolMint, stakePool = FIXTURE.stakePool) {
  const handle = defaultStakePool();
  setStakePool(handle, {
    accountType: 'StakePool',
    manager: FIXTURE.manager,
    staker: FIXTURE.staker,
    stakeDepositAuthority: FIXTURE.stakeDepositAuthority,
    stakeWithdrawBumpSeed: 255,
    validatorList: FIXTURE.validatorList,
    reserveStake: FIXTURE.reserveStake,
    poolMint,
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
  return { handle, stakePool };
}

function buildValidatorListHandle() {
  const handle = defaultValidatorList();
  setValidatorList(handle, {
    header: {
      account_type: 'ValidatorList',
      max_validators: 1,
    },
    validators: [
      {
        activeStakeLamports: 1_000n,
        transientStakeLamports: 0n,
        lastUpdateEpoch: 1n,
        transientSeedSuffix: 0n,
        validatorSeedSuffix: 0,
        status: 'Active',
        voteAccountAddress: FIXTURE.validatorVote,
      },
    ],
  });
  return handle;
}

function initRouterFor(routes: Array<{ swap: string; inp?: string; out?: string }>) {
  const router = newSanctumRouter();
  const { handle: poolA } = buildStakePoolHandle();
  const { handle: poolB } = buildStakePoolHandle(FIXTURE.altPoolMint, FIXTURE.altStakePool);
  const validatorList = buildValidatorListHandle();
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
    {
      mint: FIXTURE.altPoolMint,
      init: {
        pool: 'spl',
        stakePoolAddr: FIXTURE.altStakePool,
        stakePoolProgramAddr: SANCTUM_SPL_STAKE_POOL_PROGRAM,
        validatorListAddr: FIXTURE.validatorList,
        reserveStakeAddr: FIXTURE.reserveStake,
      },
    },
  ]);
  updateRouter(
    router,
    routes as never,
    new Map([
      [
        FIXTURE.stakePool,
        {
          owner: SANCTUM_SPL_STAKE_POOL_PROGRAM,
          data: serStakePool(poolA),
          lamports: 1n,
        },
      ],
      [
        FIXTURE.altStakePool,
        {
          owner: SANCTUM_SPL_STAKE_POOL_PROGRAM,
          data: serStakePool(poolB),
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
        FIXTURE.reserveStake,
        {
          owner: STAKE_PROGRAM,
          data: new Uint8Array(200),
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

describe('Sanctum actions', () => {
  it('matches SDK instruction encoding for deposit_sol', async () => {
    const wallet = new PublicKey(FIXTURE.wallet);
    const router = initRouterFor([{ swap: 'depositSol', out: FIXTURE.poolMint }]);
    const sdkInstruction = depositSolIx(router, {
      amt: 123n,
      out: FIXTURE.poolMint,
      signerInp: FIXTURE.wallet,
      signerOut: FIXTURE.userLstAta,
      signer: FIXTURE.wallet,
    });
    const [feeTokenAccount] = findFeeTokenAccountPda(FIXTURE.poolMint);
    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);

    const prepared = await prepareRuntimeInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      operationId: 'deposit_sol',
      input: {
        amt: '123',
        out_mint: FIXTURE.poolMint,
        signer_out: FIXTURE.userLstAta,
        route_source: sdkInstruction.accounts[3]!.address,
        route_destination: sdkInstruction.accounts[4]!.address,
        stake_pool: FIXTURE.stakePool,
        withdraw_authority: withdrawAuthority,
        reserve_stake: FIXTURE.reserveStake,
        manager_fee_account: FIXTURE.managerFeeAccount,
      },
      connection: {} as never,
      walletPublicKey: wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: wallet,
    });

    expect(prepared.accounts.fee_token_account).toBe(feeTokenAccount);
    expect(prepared.accounts.withdraw_authority).toBe(withdrawAuthority);
    expect(runtimePreview.programId).toBe(SANCTUM_PROGRAM_ID);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.accounts.map((account) => ({
      pubkey: account.address,
      isSigner: account.role === 2 || account.role === 3,
      isWritable: account.role === 1 || account.role === 3,
    }))));
  });

  it('matches SDK instruction encoding for deposit_stake', async () => {
    const wallet = new PublicKey(FIXTURE.wallet);
    const router = initRouterFor([{ swap: 'depositStake', out: FIXTURE.poolMint }]);
    const sdkInstruction = depositStakeIx(router, {
      inp: FIXTURE.validatorVote,
      out: FIXTURE.poolMint,
      signerInp: FIXTURE.depositStake,
      signerOut: FIXTURE.userLstAta,
      signer: FIXTURE.wallet,
    });
    const [feeTokenAccount] = findFeeTokenAccountPda(FIXTURE.poolMint);
    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);
    const [validatorStakeAccount] = findValidatorStakeAccountPda(
      SANCTUM_SPL_STAKE_POOL_PROGRAM,
      FIXTURE.validatorVote,
      FIXTURE.stakePool,
      0,
    );

    const prepared = await prepareRuntimeInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      operationId: 'deposit_stake',
      input: {
        out_mint: FIXTURE.poolMint,
        signer_inp: FIXTURE.depositStake,
        signer_out: FIXTURE.userLstAta,
        stake_pool: FIXTURE.stakePool,
        validator_list: FIXTURE.validatorList,
        stake_deposit_authority: FIXTURE.stakeDepositAuthority,
        withdraw_authority: withdrawAuthority,
        validator_stake_account: validatorStakeAccount,
        reserve_stake: FIXTURE.reserveStake,
        manager_fee_account: FIXTURE.managerFeeAccount,
      },
      connection: {} as never,
      walletPublicKey: wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: wallet,
    });

    expect(prepared.accounts.fee_token_account).toBe(feeTokenAccount);
    expect(prepared.accounts.validator_stake_account).toBe(validatorStakeAccount);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.accounts.map((account) => ({
      pubkey: account.address,
      isSigner: account.role === 2 || account.role === 3,
      isWritable: account.role === 1 || account.role === 3,
    }))));
  });

  it('matches SDK instruction encoding for withdraw_sol', async () => {
    const wallet = new PublicKey(FIXTURE.wallet);
    const router = initRouterFor([{ swap: 'withdrawSol', inp: FIXTURE.poolMint }]);
    const sdkInstruction = withdrawSolIx(router, {
      amt: 321n,
      inp: FIXTURE.poolMint,
      signerInp: FIXTURE.userLstAta,
      signerOut: FIXTURE.wallet,
      signer: FIXTURE.wallet,
    });
    const [withdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);

    const prepared = await prepareRuntimeInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      operationId: 'withdraw_sol',
      input: {
        amt: '321',
        inp_mint: FIXTURE.poolMint,
        signer_inp: FIXTURE.userLstAta,
        route_destination: sdkInstruction.accounts[3]!.address,
        stake_pool: FIXTURE.stakePool,
        withdraw_authority: withdrawAuthority,
        reserve_stake: FIXTURE.reserveStake,
        manager_fee_account: FIXTURE.managerFeeAccount,
      },
      connection: {} as never,
      walletPublicKey: wallet,
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: wallet,
    });

    expect(prepared.accounts.withdraw_authority).toBe(withdrawAuthority);
    expect(prepared.accounts.wsol_mint).toBe(WSOL_MINT);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(sdkInstruction.data));
    expect(runtimePreview.keys).toEqual(comparableKeys(sdkInstruction.accounts.map((account) => ({
      pubkey: account.address,
      isSigner: account.role === 2 || account.role === 3,
      isWritable: account.role === 1 || account.role === 3,
    }))));
  });

  it('prepares swap_lst with the canonical Sanctum fee and bridge stake addresses', async () => {
    const wallet = new PublicKey(FIXTURE.wallet);
    const [inpFeeTokenAccount] = findFeeTokenAccountPda(FIXTURE.poolMint);
    const [outFeeTokenAccount] = findFeeTokenAccountPda(FIXTURE.altPoolMint);
    const [bridgeStake] = findBridgeStakeAccPda(FIXTURE.wallet, 7);
    const slumdogStake = createSlumdogStakeAddr(bridgeStake);
    const [inpWithdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.stakePool);
    const [outWithdrawAuthority] = findWithdrawAuthPda(SANCTUM_SPL_STAKE_POOL_PROGRAM, FIXTURE.altStakePool);
    const [inpValidatorStakeAccount] = findValidatorStakeAccountPda(
      SANCTUM_SPL_STAKE_POOL_PROGRAM,
      FIXTURE.validatorVote,
      FIXTURE.stakePool,
      0,
    );
    const [outValidatorStakeAccount] = findValidatorStakeAccountPda(
      SANCTUM_SPL_STAKE_POOL_PROGRAM,
      FIXTURE.validatorVote,
      FIXTURE.altStakePool,
      0,
    );

    const prepared = await prepareRuntimeInstruction({
      protocolId: SANCTUM_PROTOCOL_ID,
      operationId: 'swap_lst',
      input: {
        amt: '123',
        inp_mint: FIXTURE.poolMint,
        out_mint: FIXTURE.altPoolMint,
        signer_inp: FIXTURE.userLstAta,
        signer_out: FIXTURE.userLstAtaOut,
        bridge_stake_seed: 7,
        bridge_stake: bridgeStake,
        slumdog_stake: slumdogStake,
        inp_stake_pool: FIXTURE.stakePool,
        inp_validator_list: FIXTURE.validatorList,
        inp_withdraw_authority: inpWithdrawAuthority,
        inp_validator_stake_account: inpValidatorStakeAccount,
        inp_reserve_stake: FIXTURE.reserveStake,
        inp_manager_fee_account: FIXTURE.managerFeeAccount,
        out_stake_pool: FIXTURE.altStakePool,
        out_validator_list: FIXTURE.validatorList,
        out_stake_deposit_authority: FIXTURE.stakeDepositAuthority,
        out_withdraw_authority: outWithdrawAuthority,
        out_validator_stake_account: outValidatorStakeAccount,
        out_reserve_stake: FIXTURE.reserveStake,
        out_manager_fee_account: FIXTURE.managerFeeAccount,
      },
      connection: {} as never,
      walletPublicKey: wallet,
    });

    expect(prepared.instructionName).toBe('prefundSwapViaStake');
    expect(prepared.accounts.signer).toBe(FIXTURE.wallet);
    expect(prepared.accounts.inp_fee_token_account).toBe(inpFeeTokenAccount);
    expect(prepared.accounts.out_fee_token_account).toBe(outFeeTokenAccount);
    expect(prepared.accounts.bridge_stake).toBe(bridgeStake);
    expect(prepared.accounts.slumdog_stake).toBe(slumdogStake);
    expect(prepared.args.amt).toBe('123');
    expect(prepared.args.bridge_stake_seed).toBe('7');

    expect(() =>
      prefundSwapViaStakeIx(initRouterFor([{ swap: 'depositSol', out: FIXTURE.poolMint }]), {
        amt: 123n,
        inp: FIXTURE.poolMint,
        out: FIXTURE.altPoolMint,
        signerInp: FIXTURE.userLstAta,
        signerOut: FIXTURE.userLstAtaOut,
        bridgeStakeSeed: 7,
        signer: FIXTURE.wallet,
        bridgeVote: FIXTURE.validatorVote,
      }),
    ).toThrow();
  });
});
