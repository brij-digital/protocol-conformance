import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
  getClosePositionWithTokenExtensionsInstruction,
  getDecreaseLiquidityV2Instruction,
  getPositionAddress,
} from '@orca-so/whirlpools-client';
import { tickIndexToSqrtPrice } from '@orca-so/whirlpools-core';
import {
  prepareRuntimeInstruction,
  previewIdlInstruction,
  runRuntimeView,
} from '@brij-digital/apppack-runtime';
import { runActionRunner } from '@brij-digital/apppack-runtime/actionRunner';
import { address, createNoopSigner } from '@solana/kit';
import {
  buildPositionArgs,
  buildWhirlpoolArgs,
  POSITION_MINT,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_PROGRAM,
} from './fixtures.js';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function readAccount(accounts: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = accounts[key];
    if (value !== undefined) {
      return value;
    }
  }
  throw new Error(`Missing expected account key. Tried: ${keys.join(', ')}`);
}

function toCamelClosePositionAccounts(accounts: Record<string, string>) {
  return {
    positionAuthority: createNoopSigner(address(readAccount(accounts, 'positionAuthority', 'position_authority'))),
    receiver: address(readAccount(accounts, 'receiver')),
    position: address(readAccount(accounts, 'position')),
    positionMint: address(readAccount(accounts, 'positionMint', 'position_mint')),
    positionTokenAccount: address(readAccount(accounts, 'positionTokenAccount', 'position_token_account')),
    token2022Program: address(readAccount(accounts, 'token2022Program', 'token2022_program', 'token_2022_program')),
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

async function buildToken2022PositionConnection(options?: { liquidity?: bigint }) {
  const liquidity = options?.liquidity ?? 500000n;
  const connection = new StaticAccountConnection();
  connection.setWhirlpool(
    buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      sqrtPrice: tickIndexToSqrtPrice(0),
    }),
  );

  const [position] = await getPositionAddress(address(POSITION_MINT));
  connection.setPosition(
    position,
    buildPositionArgs({
      positionMint: POSITION_MINT,
      tickLowerIndex: -64,
      tickUpperIndex: 64,
      liquidity,
    }),
  );
  connection.setRawAccount(POSITION_MINT, TOKEN_2022_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_A, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_B, TOKEN_PROGRAM);

  return { connection, position, liquidity };
}

function loadRunnerSpec(filename: string) {
  return JSON.parse(
    fs.readFileSync(new URL(`../../../protocol-registry/action-runners/${filename}`, import.meta.url), 'utf8'),
  );
}

async function executeRunner(spec: Record<string, unknown>, input: Record<string, unknown>, connection: StaticAccountConnection) {
  return runActionRunner({
    spec: spec as never,
    input,
    executeStep: async (step) => {
      if (step.kind === 'read') {
        const view = await runRuntimeView({
          protocolId: step.protocolId,
          operationId: step.operationId,
          input: step.input,
          connection: connection as never,
          walletPublicKey: getTestWallet(),
        });
        return { output: view.output, meta: { derived: view.derived } };
      }

      const prepared = await prepareRuntimeInstruction({
        protocolId: step.protocolId,
        operationId: step.operationId,
        input: step.input,
        connection: connection as never,
        walletPublicKey: getTestWallet(),
      });
      return { output: prepared };
    },
  });
}

describe('Orca declarative runner registry', () => {
  it('close_position runner stays declarative and matches the Orca SDK instruction', async () => {
    const { connection, position } = await buildToken2022PositionConnection();
    const result = await executeRunner(
      loadRunnerSpec('orca.close_position.runner.json'),
      { position },
      connection,
    );

    const draft = result.output.draft as Record<string, unknown>;
    const draftAccounts = draft.accounts as Record<string, string>;
    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_2022_PROGRAM),
    ).toBase58();

    expect(String(draft.instructionName)).toBe('close_position_with_token_extensions');
    expect(draftAccounts.position).toBe(position);
    expect(draftAccounts.position_token_account).toBe(expectedPositionTokenAccount);

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: String(draft.instructionName),
      args: draft.args as Record<string, unknown>,
      accounts: draftAccounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getClosePositionWithTokenExtensionsInstruction(
      toCamelClosePositionAccounts(draftAccounts),
    );

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('quote_and_decrease_liquidity runner composes declarative read and write steps into the Orca SDK draft', async () => {
    const { connection, position } = await buildToken2022PositionConnection({ liquidity: 987654n });
    const result = await executeRunner(
      loadRunnerSpec('orca.quote_and_decrease_liquidity.runner.json'),
      {
        position,
        specified_token_mint: TOKEN_MINT_A,
        specified_token_amount: '1000',
        slippage_bps: '100',
      },
      connection,
    );

    const quote = result.output.quote as Record<string, unknown>;
    const draft = result.output.draft as Record<string, unknown>;
    const draftAccounts = draft.accounts as Record<string, string>;
    const directQuote = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_decrease_liquidity',
      input: {
        position,
        specified_token_mint: TOKEN_MINT_A,
        specified_token_amount: '1000',
        slippage_bps: '100',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    expect(quote).toEqual(directQuote.output);
    expect(quote.position).toBe(position);
    expect(quote.whirlpool).toBeTruthy();
    expect(String(draft.instructionName)).toBe('decrease_liquidity_v2');

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: String(draft.instructionName),
      args: draft.args as Record<string, unknown>,
      accounts: draftAccounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getDecreaseLiquidityV2Instruction({
      ...toCamelDecreaseLiquidityAccounts(draftAccounts),
      liquidityAmount: BigInt(String(quote.liquidity_delta)),
      tokenMinA: BigInt(String(quote.token_min_a)),
      tokenMinB: BigInt(String(quote.token_min_b)),
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });
});
