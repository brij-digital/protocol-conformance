import { describe, expect, it } from 'vitest';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
  getCollectFeesV2Instruction,
  getCollectRewardV2Instruction,
  getDecreaseLiquidityV2Instruction,
  getIncreaseLiquidityByTokenAmountsV2Instruction,
  getOracleAddress,
  getPositionAddress,
  getSwapV2Instruction,
  getTickArrayAddress,
  increaseLiquidityMethod,
  type TickArrayArgs,
  type WhirlpoolArgs,
} from '@orca-so/whirlpools-client';
import { address, createNoopSigner } from '@solana/kit';
import { swapQuoteByInputToken, swapQuoteByOutputToken } from '@orca-so/whirlpools-core';
import {
  explainRuntimeOperation,
  previewIdlInstruction,
  prepareRuntimeInstruction,
  runRuntimeView,
} from '@brij-digital/apppack-runtime';
import {
  buildPositionArgs,
  buildCustomTickArrayArgs,
  buildTickArrayArgs,
  buildWhirlpoolArgs,
  expectedTickArrayStarts,
  MEMO_PROGRAM,
  ORCA_WHIRLPOOL,
  POSITION_MINT,
  REWARD_MINTS,
  REWARD_VAULTS,
  SWAP_EXACT_IN_INPUT,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_PROGRAM,
  toCoreTickArray,
  toCoreWhirlpool,
} from '../src/fixtures/orca.js';
import { getTestWallet, StaticAccountConnection } from '../src/support/runtime.js';

type LoadedTickArray = {
  address: string;
  start_tick_index: number;
  ticks: unknown[];
};

const BLANK_CORE_TICK = Object.freeze({
  initialized: false,
  liquidityNet: 0n,
  liquidityGross: 0n,
  feeGrowthOutsideA: 0n,
  feeGrowthOutsideB: 0n,
  rewardGrowthsOutside: [0n, 0n, 0n],
});

function toCamelAccounts(accounts: Record<string, string>) {
  return {
    tokenProgramA: address(accounts.token_program_a),
    tokenProgramB: address(accounts.token_program_b),
    memoProgram: address(accounts.memo_program),
    tokenAuthority: createNoopSigner(address(accounts.token_authority)),
    whirlpool: address(accounts.whirlpool),
    tokenMintA: address(accounts.token_mint_a),
    tokenMintB: address(accounts.token_mint_b),
    tokenOwnerAccountA: address(accounts.token_owner_account_a),
    tokenVaultA: address(accounts.token_vault_a),
    tokenOwnerAccountB: address(accounts.token_owner_account_b),
    tokenVaultB: address(accounts.token_vault_b),
    tickArray0: address(accounts.tick_array0),
    tickArray1: address(accounts.tick_array1),
    tickArray2: address(accounts.tick_array2),
    oracle: address(accounts.oracle),
  };
}

function toCamelIncreaseLiquidityAccounts(accounts: Record<string, string>) {
  return {
    whirlpool: address(accounts.whirlpool),
    tokenProgramA: address(accounts.token_program_a),
    tokenProgramB: address(accounts.token_program_b),
    memoProgram: address(accounts.memo_program),
    positionAuthority: createNoopSigner(address(accounts.position_authority)),
    position: address(accounts.position),
    positionTokenAccount: address(accounts.position_token_account),
    tokenMintA: address(accounts.token_mint_a),
    tokenMintB: address(accounts.token_mint_b),
    tokenOwnerAccountA: address(accounts.token_owner_account_a),
    tokenOwnerAccountB: address(accounts.token_owner_account_b),
    tokenVaultA: address(accounts.token_vault_a),
    tokenVaultB: address(accounts.token_vault_b),
    tickArrayLower: address(accounts.tick_array_lower),
    tickArrayUpper: address(accounts.tick_array_upper),
  };
}

function toCamelDecreaseLiquidityAccounts(accounts: Record<string, string>) {
  return {
    whirlpool: address(accounts.whirlpool),
    tokenProgramA: address(accounts.token_program_a),
    tokenProgramB: address(accounts.token_program_b),
    memoProgram: address(accounts.memo_program),
    positionAuthority: createNoopSigner(address(accounts.position_authority)),
    position: address(accounts.position),
    positionTokenAccount: address(accounts.position_token_account),
    tokenMintA: address(accounts.token_mint_a),
    tokenMintB: address(accounts.token_mint_b),
    tokenOwnerAccountA: address(accounts.token_owner_account_a),
    tokenOwnerAccountB: address(accounts.token_owner_account_b),
    tokenVaultA: address(accounts.token_vault_a),
    tokenVaultB: address(accounts.token_vault_b),
    tickArrayLower: address(accounts.tick_array_lower),
    tickArrayUpper: address(accounts.tick_array_upper),
  };
}

function toCamelCollectFeesAccounts(accounts: Record<string, string>) {
  return {
    whirlpool: address(accounts.whirlpool),
    positionAuthority: createNoopSigner(address(accounts.position_authority)),
    position: address(accounts.position),
    positionTokenAccount: address(accounts.position_token_account),
    tokenMintA: address(accounts.token_mint_a),
    tokenMintB: address(accounts.token_mint_b),
    tokenOwnerAccountA: address(accounts.token_owner_account_a),
    tokenVaultA: address(accounts.token_vault_a),
    tokenOwnerAccountB: address(accounts.token_owner_account_b),
    tokenVaultB: address(accounts.token_vault_b),
    tokenProgramA: address(accounts.token_program_a),
    tokenProgramB: address(accounts.token_program_b),
    memoProgram: address(accounts.memo_program),
  };
}

function toCamelCollectRewardAccounts(accounts: Record<string, string>) {
  return {
    whirlpool: address(accounts.whirlpool),
    positionAuthority: createNoopSigner(address(accounts.position_authority)),
    position: address(accounts.position),
    positionTokenAccount: address(accounts.position_token_account),
    rewardOwnerAccount: address(accounts.reward_owner_account),
    rewardMint: address(accounts.reward_mint),
    rewardVault: address(accounts.reward_vault),
    rewardTokenProgram: address(accounts.reward_token_program),
    memoProgram: address(accounts.memo_program),
  };
}

function toCoreWhirlpoolFixture(tickCurrentIndex: number) {
  return {
    feeTierIndexSeed: new Uint8Array([64, 0]),
    tickSpacing: 64,
    feeRate: 300,
    protocolFeeRate: 1800,
    liquidity: 32523523532n,
    sqrtPrice: 32523523532n,
    tickCurrentIndex,
    feeGrowthGlobalA: 0n,
    feeGrowthGlobalB: 0n,
    rewardLastUpdatedTimestamp: 0n,
    rewardInfos: [
      { emissionsPerSecondX64: 0n, growthGlobalX64: 0n },
      { emissionsPerSecondX64: 0n, growthGlobalX64: 0n },
      { emissionsPerSecondX64: 0n, growthGlobalX64: 0n },
    ],
  };
}

function toCoreTickArrays(starts: number[]) {
  return starts.map((startTickIndex) => ({
    startTickIndex,
    ticks: Array.from({ length: 88 }, () => BLANK_CORE_TICK),
  }));
}

function getLoadedTickArrays(view: Awaited<ReturnType<typeof runRuntimeView>>): LoadedTickArray[] {
  const raw = view.derived.tick_arrays_data;
  if (!Array.isArray(raw)) {
    throw new Error('tick_arrays_data must be an array in the comparison harness.');
  }
  return raw as LoadedTickArray[];
}

async function getExpectedTickArrayAddresses(starts: number[]) {
  return Promise.all(
    starts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
  );
}

function setTickArraysOnConnection(
  connection: StaticAccountConnection,
  addresses: string[],
  tickArrayArgs: TickArrayArgs[],
) {
  addresses.forEach((tickArrayAddress, index) => {
    connection.setTickArray(tickArrayAddress, tickArrayArgs[index]);
  });
}

async function buildPositionBackedConnection(options?: {
  tickLowerIndex?: number;
  tickUpperIndex?: number;
  tickSpacing?: number;
}) {
  const connection = new StaticAccountConnection();
  connection.setWhirlpool(
    buildWhirlpoolArgs({
      tickSpacing: options?.tickSpacing ?? 64,
      tickCurrentIndex: 0,
    }),
  );

  const [position] = await getPositionAddress(address(POSITION_MINT));
  const tickLowerIndex = options?.tickLowerIndex ?? -5632;
  const tickUpperIndex = options?.tickUpperIndex ?? 5632;
  connection.setPosition(
    position,
    buildPositionArgs({
      positionMint: POSITION_MINT,
      tickLowerIndex,
      tickUpperIndex,
    }),
  );
  connection.setRawAccount(POSITION_MINT, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_A, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_B, TOKEN_PROGRAM);

  return { connection, position, tickLowerIndex, tickUpperIndex };
}

function tickIndexToSqrtPriceX64Reference(tickIndex: number): string {
  if (tickIndex >= 0) {
    let ratio =
      (tickIndex & 1) !== 0
        ? 79232123823359799118286999567n
        : 79228162514264337593543950336n;
    const factors: Array<[number, bigint]> = [
      [2, 79236085330515764027303304731n],
      [4, 79244008939048815603706035061n],
      [8, 79259858533276714757314932305n],
      [16, 79291567232598584799939703904n],
      [32, 79355022692464371645785046466n],
      [64, 79482085999252804386437311141n],
      [128, 79736823300114093921829183326n],
      [256, 80248749790819932309965073892n],
      [512, 81282483887344747381513967011n],
      [1024, 83390072131320151908154831281n],
      [2048, 87770609709833776024991924138n],
      [4096, 97234110755111693312479820773n],
      [8192, 119332217159966728226237229890n],
      [16384, 179736315981702064433883588727n],
      [32768, 407748233172238350107850275304n],
      [65536, 2098478828474011932436660412517n],
      [131072, 55581415166113811149459800483533n],
      [262144, 38992368544603139932233054999993551n],
    ];
    for (const [bit, factor] of factors) {
      if ((tickIndex & bit) !== 0) {
        ratio = (ratio * factor) >> 96n;
      }
    }
    return (ratio >> 32n).toString();
  }

  const absTick = Math.abs(tickIndex);
  let ratio = (absTick & 1) !== 0 ? 18445821805675392311n : 18446744073709551616n;
  const factors: Array<[number, bigint]> = [
    [2, 18444899583751176498n],
    [4, 18443055278223354162n],
    [8, 18439367220385604838n],
    [16, 18431993317065449817n],
    [32, 18417254355718160513n],
    [64, 18387811781193591352n],
    [128, 18329067761203520168n],
    [256, 18212142134806087854n],
    [512, 17980523815641551639n],
    [1024, 17526086738831147013n],
    [2048, 16651378430235024244n],
    [4096, 15030750278693429944n],
    [8192, 12247334978882834399n],
    [16384, 8131365268884726200n],
    [32768, 3584323654723342297n],
    [65536, 696457651847595233n],
    [131072, 26294789957452057n],
    [262144, 37481735321082n],
  ];
  for (const [bit, factor] of factors) {
    if ((absTick & bit) !== 0) {
      ratio = (ratio * factor) >> 64n;
    }
  }
  return ratio.toString();
}

function sqrtPriceForTickIndexReference(tickIndex: number): bigint {
  return BigInt(tickIndexToSqrtPriceX64Reference(tickIndex));
}

function midpointSqrtPriceWithinTickRange(tickIndex: number, tickSpacing: number): bigint {
  const lower = sqrtPriceForTickIndexReference(tickIndex);
  const upper = sqrtPriceForTickIndexReference(tickIndex + tickSpacing);
  return (lower + upper) / 2n;
}

describe('Orca runtime comparison harness', () => {
  it('exposes the focused Orca runtime surface we want to validate', async () => {
    const write = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'swap_exact_in',
    });
    const view = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
    });

    expect(write.operationKind).toBe('write');
    expect(view.operationKind).toBe('view');
    expect(write.instruction).toBe('swap_v2');
    expect(view.loadInstruction).toBe('swap_v2');
    expect(Array.isArray(view.steps)).toBe(true);
    expect(view.steps.some((entry) => entry.phase === 'load' && entry.step.kind === 'decode_accounts')).toBe(true);
  });

  it('matches Orca derived accounts and low-level swap_v2 instruction encoding for swap_exact_in', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'swap_exact_in',
      input: { ...SWAP_EXACT_IN_INPUT },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedAtaA = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_A),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaB = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_B),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedOracle = (await getOracleAddress(address(ORCA_WHIRLPOOL)))[0];

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.token_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.token_owner_account_a).toBe(expectedAtaA);
    expect(prepared.accounts.token_owner_account_b).toBe(expectedAtaB);
    expect(prepared.accounts.oracle).toBe(expectedOracle);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });

    const orcaInstruction = getSwapV2Instruction({
      ...toCamelAccounts(prepared.accounts),
      amount: BigInt(String(prepared.args.amount)),
      otherAmountThreshold: BigInt(String(prepared.args.other_amount_threshold)),
      sqrtPriceLimit: BigInt(String(prepared.args.sqrt_price_limit)),
      amountSpecifiedIsInput: Boolean(prepared.args.amount_specified_is_input),
      aToB: Boolean(prepared.args.a_to_b),
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca derived accounts and low-level increaseLiquidityByTokenAmountsV2 instruction encoding', async () => {
    const { connection, position } = await buildPositionBackedConnection();

    const [tickArrayLower] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), -5632);
    const [tickArrayUpper] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), 5632);
    connection.setTickArray(tickArrayLower, buildTickArrayArgs(-5632));
    connection.setTickArray(tickArrayUpper, buildTickArrayArgs(5632));

    const method = increaseLiquidityMethod('ByTokenAmounts', {
      tokenMaxA: 10n,
      tokenMaxB: 12n,
      minSqrtPrice: 1n,
      maxSqrtPrice: 2n,
    });

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'increase_liquidity_by_token_amounts_v2',
      input: {
        position,
        method,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaA = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_A),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaB = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_B),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.position_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.position).toBe(position);
    expect(prepared.accounts.position_token_account).toBe(expectedPositionTokenAccount);
    expect(prepared.accounts.token_owner_account_a).toBe(expectedAtaA);
    expect(prepared.accounts.token_owner_account_b).toBe(expectedAtaB);
    expect(prepared.accounts.tick_array_lower).toBe(tickArrayLower);
    expect(prepared.accounts.tick_array_upper).toBe(tickArrayUpper);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });

    const orcaInstruction = getIncreaseLiquidityByTokenAmountsV2Instruction({
      ...toCamelIncreaseLiquidityAccounts(prepared.accounts),
      method,
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca derived accounts and low-level decreaseLiquidityV2 instruction encoding', async () => {
    const { connection, position } = await buildPositionBackedConnection();

    const [tickArrayLower] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), -5632);
    const [tickArrayUpper] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), 5632);
    connection.setTickArray(tickArrayLower, buildTickArrayArgs(-5632));
    connection.setTickArray(tickArrayUpper, buildTickArrayArgs(5632));

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'decrease_liquidity_v2',
      input: {
        position,
        liquidity_amount: '42',
        token_min_a: '10',
        token_min_b: '12',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaA = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_A),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaB = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_B),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.position_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.position_token_account).toBe(expectedPositionTokenAccount);
    expect(prepared.accounts.token_owner_account_a).toBe(expectedAtaA);
    expect(prepared.accounts.token_owner_account_b).toBe(expectedAtaB);
    expect(prepared.accounts.tick_array_lower).toBe(tickArrayLower);
    expect(prepared.accounts.tick_array_upper).toBe(tickArrayUpper);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });

    const orcaInstruction = getDecreaseLiquidityV2Instruction({
      ...toCamelDecreaseLiquidityAccounts(prepared.accounts),
      liquidityAmount: 42n,
      tokenMinA: 10n,
      tokenMinB: 12n,
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca derived accounts and low-level collectFeesV2 instruction encoding', async () => {
    const { connection, position } = await buildPositionBackedConnection();

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'collect_fees_v2',
      input: {
        position,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaA = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_A),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedAtaB = getAssociatedTokenAddressSync(
      new PublicKey(TOKEN_MINT_B),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.position_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.position_token_account).toBe(expectedPositionTokenAccount);
    expect(prepared.accounts.token_owner_account_a).toBe(expectedAtaA);
    expect(prepared.accounts.token_owner_account_b).toBe(expectedAtaB);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });

    const orcaInstruction = getCollectFeesV2Instruction({
      ...toCamelCollectFeesAccounts(prepared.accounts),
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca derived accounts and low-level collectRewardV2 instruction encoding', async () => {
    const { connection, position } = await buildPositionBackedConnection();
    const rewardIndex = 1;
    const rewardMint = REWARD_MINTS[rewardIndex];
    connection.setRawAccount(rewardMint, TOKEN_PROGRAM);

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'collect_reward_v2',
      input: {
        position,
        reward_index: String(rewardIndex),
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();
    const expectedRewardAta = getAssociatedTokenAddressSync(
      new PublicKey(rewardMint),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_PROGRAM),
    ).toBase58();

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.position_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.position_token_account).toBe(expectedPositionTokenAccount);
    expect(prepared.accounts.reward_mint).toBe(rewardMint);
    expect(prepared.accounts.reward_vault).toBe(REWARD_VAULTS[rewardIndex]);
    expect(prepared.accounts.reward_token_program).toBe(TOKEN_PROGRAM);
    expect(prepared.accounts.reward_owner_account).toBe(expectedRewardAta);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });

    const orcaInstruction = getCollectRewardV2Instruction({
      ...toCamelCollectRewardAccounts(prepared.accounts),
      rewardIndex,
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca tick-array derivation for a simple A->B quote_exact_in case', async () => {
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(buildWhirlpoolArgs({ tickCurrentIndex: 0 }));

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, aToB: true });
    const expectedAddresses = await Promise.all(
      expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
    );
    expectedAddresses.forEach((tickArrayAddress, index) => {
      connection.setTickArray(tickArrayAddress, buildTickArrayArgs(expectedStarts[index]));
    });
    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_in: '1000',
        slippage_bps: '100',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByInputToken(
      1000n,
      true,
      100,
      toCoreWhirlpoolFixture(0),
      undefined,
      toCoreTickArrays([...expectedStarts]),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(view.derived.tick_array_summaries).toEqual(
      expectedAddresses.map((address, index) => ({
        address,
        start_tick_index: expectedStarts[index],
      })),
    );
    expect(view.derived.initialized_tick_count).toBe('0');
    expect(view.derived.directional_initialized_tick_count).toBe('0');
    expect(view.derived.first_initialized_tick).toBeNull();
    expect(view.derived.next_initialized_tick).toBeNull();
    expect(view.derived.next_swap_target_tick).toEqual(
      expect.objectContaining({
        initialized: false,
        terminal: true,
        tick_index: String(expectedStarts[2]),
        tick_array_start_index: expectedStarts[2],
        tick_array_address: expectedAddresses[2],
      }),
    );
    expect(view.derived.next_swap_target_tick_sqrt_price_x64).toBe(
      tickIndexToSqrtPriceX64Reference(expectedStarts[2]),
    );
    expect(view.derived.initialized_liquidity_gross_total).toBe('0');
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
    expect(output.pool_fee_bps).toBe(coreQuote.tradeFeeRateMin);
  });

  it('matches Orca B->A tick-array derivation and zero-output quote on the current edge fixture', async () => {
    const tickCurrentIndex = 64 * 88 - 64;
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(buildWhirlpoolArgs({ tickCurrentIndex }));

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, aToB: false });
    const expectedAddresses = await Promise.all(
      expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
    );
    expectedAddresses.forEach((tickArrayAddress, index) => {
      connection.setTickArray(tickArrayAddress, buildTickArrayArgs(expectedStarts[index]));
    });
    const coreQuote = swapQuoteByInputToken(
      1n,
      false,
      100,
      toCoreWhirlpoolFixture(tickCurrentIndex),
      undefined,
      toCoreTickArrays([...expectedStarts]),
      0n,
      undefined,
      undefined,
    );
    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '1',
        slippage_bps: '100',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(expectedStarts).toEqual([5632, 11264, 16896]);
    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(view.derived.initialized_tick_count).toBe('0');
    expect(view.derived.directional_initialized_tick_count).toBe('0');
    expect(view.derived.next_initialized_tick).toBeNull();
    expect(view.derived.next_swap_target_tick).toEqual(
      expect.objectContaining({
        initialized: false,
        terminal: true,
        tick_index: '22464',
        tick_array_start_index: expectedStarts[2],
        tick_array_address: expectedAddresses[2],
      }),
    );
    expect(view.derived.next_swap_target_tick_sqrt_price_x64).toBe(
      tickIndexToSqrtPriceX64Reference(22464),
    );
    expect(coreQuote.tokenEstOut.toString()).toBe('0');
    expect(coreQuote.tokenMinOut.toString()).toBe('0');
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca quote semantics after loading initialized tick arrays', async () => {
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(
      buildWhirlpoolArgs({
        tickCurrentIndex: 0,
        tickSpacing: 2,
        sqrtPrice: 1n << 64n,
        feeRate: 3000,
        liquidity: 265000n,
      }),
    );

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 2, aToB: false });
    const expectedAddresses = await Promise.all(
      expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
    );
    expectedAddresses.forEach((tickArrayAddress, index) => {
      connection.setTickArray(
        tickArrayAddress,
        buildTickArrayArgs(expectedStarts[index], { initialized: true, positiveLiquidity: true }),
      );
    });

    const coreQuote = swapQuoteByInputToken(
      1000n,
      false,
      1000,
      {
        tickCurrentIndex: 0,
        feeGrowthGlobalA: 0n,
        feeGrowthGlobalB: 0n,
        protocolFeeRate: 1800,
        feeRate: 3000,
        liquidity: 265000n,
        sqrtPrice: 1n << 64n,
        tickSpacing: 2,
        feeTierIndexSeed: [2, 0],
        rewardLastUpdatedTimestamp: 0n,
        rewardInfos: [
          { growthGlobalX64: 0n, emissionsPerSecondX64: 0n },
          { growthGlobalX64: 0n, emissionsPerSecondX64: 0n },
          { growthGlobalX64: 0n, emissionsPerSecondX64: 0n },
        ],
      },
      undefined,
      toCoreTickArrays([...expectedStarts]).map((tickArray) => ({
        ...tickArray,
        ticks: Array.from({ length: 88 }, () => ({
          initialized: true,
          liquidityNet: 1000n,
          liquidityGross: 1000n,
          feeGrowthOutsideA: 0n,
          feeGrowthOutsideB: 0n,
          rewardGrowthsOutside: [0n, 0n, 0n],
        })),
      })),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '1000',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;
    const loadedTickArrays = getLoadedTickArrays(view);

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(loadedTickArrays.map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(view.derived.tick_array_summaries).toEqual(
      expectedAddresses.map((address, index) => ({
        address,
        start_tick_index: expectedStarts[index],
      })),
    );
    expect(view.derived.initialized_tick_count).toBe(String(3 * 88));
    expect((view.derived.first_initialized_tick as Record<string, unknown>).initialized).toBe(true);
    expect((view.derived.first_initialized_tick as Record<string, unknown>).tick_index).toBe('0');
    expect(view.derived.directional_initialized_tick_count).toBe(String(3 * 88 - 1));
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '2',
        tick_array_start_index: 0,
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(view.derived.next_swap_target_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '2',
        tick_array_start_index: 0,
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(view.derived.next_swap_target_tick_sqrt_price_x64).toBe(
      tickIndexToSqrtPriceX64Reference(2),
    );
    expect(view.derived.initialized_liquidity_gross_total).toBe(String(3 * 88 * 1000));
    expect(loadedTickArrays.every((entry) => Array.isArray(entry.ticks))).toBe(true);
    expect(coreQuote.tokenEstOut.toString()).toBe('929');
    expect(coreQuote.tokenMinOut.toString()).toBe('836');
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca A->B quote semantics with initialized ticks across multiple arrays', async () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      liquidity: 265000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 2, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs = expectedStarts.map((startIndex) =>
      buildTickArrayArgs(startIndex, { initialized: true, positiveLiquidity: true }),
    );
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      1000n,
      true,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_in: '1000',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe(String(3 * 88));
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca sparse B->A quote semantics across selected initialized ticks', async () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 4,
      sqrtPrice: 1n << 64n,
      feeRate: 2500,
      liquidity: 600000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 4, aToB: false });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs: TickArrayArgs[] = [
      buildCustomTickArrayArgs(expectedStarts[0], [
        { offset: 1, liquidityNet: 5000n, liquidityGross: 5000n },
        { offset: 3, liquidityNet: -2000n, liquidityGross: 2000n },
        { offset: 7, liquidityNet: 4000n, liquidityGross: 4000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[1], [
        { offset: 0, liquidityNet: 3000n, liquidityGross: 3000n },
        { offset: 10, liquidityNet: -1000n, liquidityGross: 1000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[2], []),
    ];
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      5000n,
      false,
      300,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '5000',
        slippage_bps: '300',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe('5');
    expect(view.derived.directional_initialized_tick_count).toBe('5');
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '4',
        tick_array_start_index: expectedStarts[0],
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca sparse A->B quote semantics with negative current ticks', async () => {
    const tickCurrentIndex = -560;
    const tickSpacing = 8;
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex,
      tickSpacing,
      sqrtPrice: sqrtPriceForTickIndexReference(tickCurrentIndex),
      feeRate: 4200,
      liquidity: 850000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, tickSpacing, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs: TickArrayArgs[] = [
      buildCustomTickArrayArgs(expectedStarts[0], [
        { offset: 10, liquidityNet: 15000n, liquidityGross: 15000n },
        { offset: 14, liquidityNet: -4000n, liquidityGross: 4000n },
        { offset: 18, liquidityNet: 2000n, liquidityGross: 2000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[1], [
        { offset: 75, liquidityNet: 5000n, liquidityGross: 5000n },
        { offset: 80, liquidityNet: -3500n, liquidityGross: 3500n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[2], [{ offset: 12, liquidityNet: 6000n, liquidityGross: 6000n }]),
    ];
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      4200n,
      true,
      250,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_in: '4200',
        slippage_bps: '250',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe('6');
    expect(view.derived.directional_initialized_tick_count).toBe('6');
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '-560',
        tick_array_start_index: expectedStarts[0],
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca B->A quote semantics with non-zero current ticks and mixed spacing', async () => {
    const tickCurrentIndex = 792;
    const tickSpacing = 3;
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex,
      tickSpacing,
      sqrtPrice: sqrtPriceForTickIndexReference(tickCurrentIndex),
      feeRate: 1000,
      liquidity: 950000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, tickSpacing, aToB: false });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs: TickArrayArgs[] = [
      buildCustomTickArrayArgs(expectedStarts[0], [
        { offset: 1, liquidityNet: 3000n, liquidityGross: 3000n },
        { offset: 5, liquidityNet: -1500n, liquidityGross: 1500n },
        { offset: 20, liquidityNet: 7000n, liquidityGross: 7000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[1], [
        { offset: 0, liquidityNet: -2500n, liquidityGross: 2500n },
        { offset: 11, liquidityNet: 4500n, liquidityGross: 4500n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[2], [{ offset: 8, liquidityNet: 9000n, liquidityGross: 9000n }]),
    ];
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      7300n,
      false,
      180,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '7300',
        slippage_bps: '180',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe('6');
    expect(view.derived.directional_initialized_tick_count).toBe('6');
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '795',
        tick_array_start_index: expectedStarts[0],
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca A->B quote semantics with off-grid sqrt price inside the current range', async () => {
    const tickCurrentIndex = 120;
    const tickSpacing = 4;
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex,
      tickSpacing,
      sqrtPrice: midpointSqrtPriceWithinTickRange(tickCurrentIndex, tickSpacing),
      feeRate: 1800,
      liquidity: 720000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, tickSpacing, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs: TickArrayArgs[] = [
      buildCustomTickArrayArgs(expectedStarts[0], [
        { offset: 30, liquidityNet: 6000n, liquidityGross: 6000n },
        { offset: 28, liquidityNet: -2000n, liquidityGross: 2000n },
        { offset: 24, liquidityNet: 3500n, liquidityGross: 3500n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[1], [
        { offset: 84, liquidityNet: 8000n, liquidityGross: 8000n },
        { offset: 70, liquidityNet: -1500n, liquidityGross: 1500n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[2], []),
    ];
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      6800n,
      true,
      220,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_in: '6800',
        slippage_bps: '220',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe('5');
    expect(view.derived.directional_initialized_tick_count).toBe('5');
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '120',
        tick_array_start_index: expectedStarts[0],
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca B->A quote semantics with off-grid sqrt price and deeper array crossings', async () => {
    const tickCurrentIndex = 468;
    const tickSpacing = 6;
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex,
      tickSpacing,
      sqrtPrice: midpointSqrtPriceWithinTickRange(tickCurrentIndex, tickSpacing),
      feeRate: 2200,
      liquidity: 1200000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, tickSpacing, aToB: false });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs: TickArrayArgs[] = [
      buildCustomTickArrayArgs(expectedStarts[0], [
        { offset: 79, liquidityNet: 4000n, liquidityGross: 4000n },
        { offset: 82, liquidityNet: -3000n, liquidityGross: 3000n },
        { offset: 87, liquidityNet: 5000n, liquidityGross: 5000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[1], [
        { offset: 1, liquidityNet: -2500n, liquidityGross: 2500n },
        { offset: 12, liquidityNet: 9000n, liquidityGross: 9000n },
        { offset: 32, liquidityNet: -1000n, liquidityGross: 1000n },
      ]),
      buildCustomTickArrayArgs(expectedStarts[2], [{ offset: 2, liquidityNet: 7000n, liquidityGross: 7000n }]),
    ];
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const coreQuote = swapQuoteByInputToken(
      15000n,
      false,
      160,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '15000',
        slippage_bps: '160',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(view.derived.initialized_tick_count).toBe('7');
    expect(view.derived.directional_initialized_tick_count).toBe('7');
    expect(view.derived.next_initialized_tick).toEqual(
      expect.objectContaining({
        initialized: true,
        tick_index: '474',
        tick_array_start_index: expectedStarts[0],
        tick_array_address: expectedAddresses[0],
      }),
    );
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca B->A quote semantics for larger exact-input amounts', async () => {
    const tickCurrentIndex = 64 * 88 - 64;
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(buildWhirlpoolArgs({ tickCurrentIndex }));

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, aToB: false });
    const expectedAddresses = await Promise.all(
      expectedStarts.map(async (startIndex) => (await getTickArrayAddress(address(ORCA_WHIRLPOOL), startIndex))[0]),
    );
    expectedAddresses.forEach((tickArrayAddress, index) => {
      connection.setTickArray(tickArrayAddress, buildTickArrayArgs(expectedStarts[index]));
    });
    const coreQuote = swapQuoteByInputToken(
      1000n,
      false,
      100,
      toCoreWhirlpoolFixture(tickCurrentIndex),
      undefined,
      toCoreTickArrays([...expectedStarts]),
      0n,
      undefined,
      undefined,
    );
    expect(coreQuote.tokenEstOut.toString()).toBe('17445383495056910001');
    expect(coreQuote.tokenMinOut.toString()).toBe('17270929660106340900');
    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_in: '1000',
        slippage_bps: '100',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const output = view.output as Record<string, unknown>;

    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('matches Orca A->B exact-output quote semantics on the upstream smoke-style fixture', async () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      liquidity: 265000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 2, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs = expectedStarts.map((startIndex) =>
      buildTickArrayArgs(startIndex, { initialized: true, positiveLiquidity: startIndex < 0 }),
    );
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_out',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_out: '1000',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByOutputToken(
      1000n,
      true,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(output.amount_out).toBe('1000');
    expect(output.estimated_in).toBe(coreQuote.tokenEstIn.toString());
    expect(output.maximum_in).toBe(coreQuote.tokenMaxIn.toString());
    expect(output.pool_fee_bps).toBe(coreQuote.tradeFeeRateMin);
  });

  it('matches Orca A->B exact-output quote semantics for smaller output sizes on the same smoke-style fixture', async () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      liquidity: 265000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 2, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs = expectedStarts.map((startIndex) =>
      buildTickArrayArgs(startIndex, { initialized: true, positiveLiquidity: startIndex < 0 }),
    );
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_out',
      input: {
        token_in_mint: TOKEN_MINT_A,
        token_out_mint: TOKEN_MINT_B,
        amount_out: '500',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByOutputToken(
      500n,
      true,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(output.amount_out).toBe('500');
    expect(output.estimated_in).toBe(coreQuote.tokenEstIn.toString());
    expect(output.maximum_in).toBe(coreQuote.tokenMaxIn.toString());
  });

  it('matches Orca B->A exact-output quote semantics on the smoke-style fixture via a widened core reference window', async () => {
    const tickSpacing = 2;
    const tickCurrentIndex = 0;
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex,
      tickSpacing,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      protocolFeeRate: 3000,
      liquidity: 265000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex, tickSpacing, aToB: false });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const runtimeTickArrayArgs = [
      buildTickArrayArgs(expectedStarts[0], { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(expectedStarts[1], { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(expectedStarts[2], { initialized: true, positiveLiquidity: false }),
    ];
    const coreReferenceTickArrayArgs = [
      buildTickArrayArgs(-352, { initialized: true, positiveLiquidity: true }),
      buildTickArrayArgs(-176, { initialized: true, positiveLiquidity: true }),
      ...runtimeTickArrayArgs,
    ];
    setTickArraysOnConnection(connection, expectedAddresses, runtimeTickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_out',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_out: '1000',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByOutputToken(
      1000n,
      false,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      coreReferenceTickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(view.derived.tick_arrays).toEqual(expectedAddresses);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(output.amount_out).toBe('1000');
    expect(output.estimated_in).toBe(coreQuote.tokenEstIn.toString());
    expect(output.maximum_in).toBe(coreQuote.tokenMaxIn.toString());
  });

  it('matches Orca B->A exact-output quote semantics for smaller output sizes via the widened core reference window', async () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      protocolFeeRate: 3000,
      liquidity: 265000n,
    });
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(whirlpoolArgs);

    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 2, aToB: false });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const runtimeTickArrayArgs = [
      buildTickArrayArgs(expectedStarts[0], { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(expectedStarts[1], { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(expectedStarts[2], { initialized: true, positiveLiquidity: false }),
    ];
    const coreReferenceTickArrayArgs = [
      buildTickArrayArgs(-352, { initialized: true, positiveLiquidity: true }),
      buildTickArrayArgs(-176, { initialized: true, positiveLiquidity: true }),
      ...runtimeTickArrayArgs,
    ];
    setTickArraysOnConnection(connection, expectedAddresses, runtimeTickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_out',
      input: {
        token_in_mint: TOKEN_MINT_B,
        token_out_mint: TOKEN_MINT_A,
        amount_out: '500',
        slippage_bps: '1000',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByOutputToken(
      500n,
      false,
      1000,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      coreReferenceTickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(output.amount_out).toBe('500');
    expect(output.estimated_in).toBe(coreQuote.tokenEstIn.toString());
    expect(output.maximum_in).toBe(coreQuote.tokenMaxIn.toString());
  });

  it('documents that the direct Orca core helper rejects the runtime-sized three-array window for B->A exact-output', () => {
    const whirlpoolArgs: WhirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 2,
      sqrtPrice: 1n << 64n,
      feeRate: 3000,
      protocolFeeRate: 3000,
      liquidity: 265000n,
    });
    const runtimeTickArrayArgs = [
      buildTickArrayArgs(0, { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(176, { initialized: true, positiveLiquidity: false }),
      buildTickArrayArgs(352, { initialized: true, positiveLiquidity: false }),
    ];

    expect(() =>
      swapQuoteByOutputToken(
        1000n,
        false,
        1000,
        toCoreWhirlpool(whirlpoolArgs),
        undefined,
        runtimeTickArrayArgs.map(toCoreTickArray),
        0n,
        undefined,
        undefined,
      ),
    ).toThrow(/Invalid tick array sequence/);
  });
});
