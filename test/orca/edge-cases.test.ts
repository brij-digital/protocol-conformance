import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  getCollectRewardV2Instruction,
  getDecreaseLiquidityV2Instruction,
  getIncreaseLiquidityByTokenAmountsV2Instruction,
  getTickArrayAddress,
  increaseLiquidityMethod,
} from '@orca-so/whirlpools-client';
import { address, createNoopSigner } from '@solana/kit';
import { swapQuoteByInputToken } from '@orca-so/whirlpools-core';
import { prepareRuntimeInstruction, previewIdlInstruction, runRuntimeView } from '@brij-digital/apppack-runtime';
import {
  buildTickArrayArgs,
  buildWhirlpoolArgs,
  expectedTickArrayStarts,
  MEMO_PROGRAM,
  ORCA_WHIRLPOOL,
  POSITION_MINT,
  REWARD_MINTS,
  REWARD_VAULTS,
  TEST_WALLET,
  TOKEN_PROGRAM,
  toCoreTickArray,
  toCoreWhirlpool,
} from './fixtures.js';
import {
  buildPositionBackedConnection,
  getExpectedTickArrayAddresses,
  getLoadedTickArrays,
  getTestWallet,
  getWalletAta,
  setTickArraysOnConnection,
} from './helpers.js';

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

describe('Orca edge cases', () => {
  it.each([0, 2])('matches collectRewardV2 encoding for reward_index=%i', async (rewardIndex) => {
    const { connection, position } = await buildPositionBackedConnection();
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

    expect(prepared.accounts.memo_program).toBe(MEMO_PROGRAM);
    expect(prepared.accounts.reward_mint).toBe(rewardMint);
    expect(prepared.accounts.reward_vault).toBe(REWARD_VAULTS[rewardIndex]);
    expect(prepared.accounts.reward_owner_account).toBe(getWalletAta(rewardMint));

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

    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });

  it.each([
    { tickSpacing: 1, tickLowerIndex: -88, tickUpperIndex: 88 },
    { tickSpacing: 128, tickLowerIndex: -11264, tickUpperIndex: 11264 },
  ])(
    'matches increaseLiquidityByTokenAmountsV2 encoding for tick spacing $tickSpacing',
    async ({ tickSpacing, tickLowerIndex, tickUpperIndex }) => {
      const whirlpoolArgs = buildWhirlpoolArgs({ tickSpacing, tickCurrentIndex: 0 });
      const { connection, position } = await buildPositionBackedConnection({
        tickSpacing,
        tickLowerIndex,
        tickUpperIndex,
        whirlpoolArgs,
      });
      const [tickArrayLower] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), tickLowerIndex);
      const [tickArrayUpper] = await getTickArrayAddress(address(ORCA_WHIRLPOOL), tickUpperIndex);
      connection.setTickArray(tickArrayLower, buildTickArrayArgs(tickLowerIndex));
      connection.setTickArray(tickArrayUpper, buildTickArrayArgs(tickUpperIndex));

      const method = increaseLiquidityMethod('ByTokenAmounts', {
        tokenMaxA: 10n,
        tokenMaxB: 12n,
        minSqrtPrice: 1n,
        maxSqrtPrice: 2n,
      });

      const prepared = await prepareRuntimeInstruction({
        protocolId: 'orca-whirlpool-mainnet',
        operationId: 'increase_liquidity_by_token_amounts_v2',
        input: { position, method },
        connection: connection as never,
        walletPublicKey: getTestWallet(),
      });
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

      expect(prepared.accounts.tick_array_lower).toBe(tickArrayLower);
      expect(prepared.accounts.tick_array_upper).toBe(tickArrayUpper);
      expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
      expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
    },
  );

  it('matches decreaseLiquidityV2 encoding for zero liquidity', async () => {
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
        liquidity_amount: '0',
        token_min_a: '0',
        token_min_b: '0',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getDecreaseLiquidityV2Instruction({
      ...toCamelDecreaseLiquidityAccounts(prepared.accounts),
      liquidityAmount: 0n,
      tokenMinA: 0n,
      tokenMinB: 0n,
      remainingAccountsInfo: null,
    });

    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(orcaInstruction.accounts.map((entry) => entry.address));
  });

  it('matches quote_exact_in for tickSpacing=1', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 1,
      sqrtPrice: 1n << 64n,
      feeRate: 500,
      liquidity: 900000n,
    });
    const expectedStarts = expectedTickArrayStarts({ tickCurrentIndex: 0, tickSpacing: 1, aToB: true });
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const runtimeConnection = (await buildPositionBackedConnection({ whirlpoolArgs })).connection;
    runtimeConnection.setWhirlpool(whirlpoolArgs);
    const tickArrayArgs = expectedStarts.map((startIndex) =>
      buildTickArrayArgs(startIndex, { initialized: true, positiveLiquidity: startIndex >= 0 }),
    );
    setTickArraysOnConnection(runtimeConnection, expectedAddresses, tickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintA,
        token_out_mint: whirlpoolArgs.tokenMintB,
        amount_in: '2500',
        slippage_bps: '150',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: runtimeConnection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByInputToken(
      2500n,
      true,
      150,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(view.derived.tick_array_starts).toEqual([...expectedStarts]);
    expect(getLoadedTickArrays(view).map((entry) => entry.start_tick_index)).toEqual([...expectedStarts]);
    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('fully traverses the three-array quote window on a large exact-input amount', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 64,
      sqrtPrice: 1n << 64n,
      feeRate: 300,
      liquidity: 32523523532n,
    });
    const connection = await buildPositionBackedConnection({ whirlpoolArgs });
    const expectedStarts = [0, -5632, -11264] as const;
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs = expectedStarts.map((startIndex) => buildTickArrayArgs(startIndex));
    setTickArraysOnConnection(connection.connection, expectedAddresses, tickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintA,
        token_out_mint: whirlpoolArgs.tokenMintB,
        amount_in: '18446744073709551615',
        slippage_bps: '100',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection.connection as never,
      walletPublicKey: getTestWallet(),
    });
    const swapQuoteState = view.derived.swap_quote_state as Record<string, unknown>;
    const lastTargetTick = swapQuoteState.last_target_tick as Record<string, unknown>;
    const output = view.output as Record<string, unknown>;

    expect(lastTargetTick.tick_array_start_index).toBe(expectedStarts[2]);
    expect(lastTargetTick.terminal).toBe(true);
    expect(BigInt(String(output.estimated_out))).toBeGreaterThan(0n);
    expect(BigInt(String(output.minimum_out))).toBeGreaterThan(0n);
  });

  it('matches quote_exact_in with very large liquidity values', async () => {
    const whirlpoolArgs = buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      tickSpacing: 1,
      sqrtPrice: 1n << 64n,
      feeRate: 100,
      liquidity: 1n << 120n,
    });
    const { connection } = await buildPositionBackedConnection({ whirlpoolArgs });
    const expectedStarts = [0, -88, -176] as const;
    const expectedAddresses = await getExpectedTickArrayAddresses([...expectedStarts]);
    const tickArrayArgs = expectedStarts.map((startIndex) =>
      buildTickArrayArgs(startIndex, { initialized: true, positiveLiquidity: true }),
    );
    setTickArraysOnConnection(connection, expectedAddresses, tickArrayArgs);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_exact_in',
      input: {
        token_in_mint: whirlpoolArgs.tokenMintA,
        token_out_mint: whirlpoolArgs.tokenMintB,
        amount_in: '1000000',
        slippage_bps: '50',
        whirlpool: ORCA_WHIRLPOOL,
        unwrap_sol_output: false,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });
    const coreQuote = swapQuoteByInputToken(
      1000000n,
      true,
      50,
      toCoreWhirlpool(whirlpoolArgs),
      undefined,
      tickArrayArgs.map(toCoreTickArray),
      0n,
      undefined,
      undefined,
    );
    const output = view.output as Record<string, unknown>;

    expect(output.estimated_out).toBe(coreQuote.tokenEstOut.toString());
    expect(output.minimum_out).toBe(coreQuote.tokenMinOut.toString());
  });

  it('keeps derived position token ownership stable across edge fixtures', async () => {
    const expectedPositionAta = getWalletAta(POSITION_MINT);
    const { connection, position } = await buildPositionBackedConnection();
    const rewardMint = REWARD_MINTS[0];
    connection.setRawAccount(rewardMint, TOKEN_PROGRAM);

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'collect_reward_v2',
      input: {
        position,
        reward_index: '0',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(prepared.accounts.position_token_account).toBe(expectedPositionAta);
    expect(prepared.accounts.position_authority).toBe(TEST_WALLET);
    expect(prepared.accounts.reward_token_program).toBe(TOKEN_PROGRAM);
  });
});
