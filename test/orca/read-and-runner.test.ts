import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
  getDecreaseLiquidityV2Instruction,
  getIncreaseLiquidityByTokenAmountsV2Instruction,
  getOpenPositionWithTokenExtensionsInstruction,
  getPositionAddress,
  increaseLiquidityMethod,
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
  ORCA_WHIRLPOOL,
  POSITION_MINT,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_PROGRAM,
} from './fixtures.js';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const OPEN_POSITION_MINT = '3M9yXxv7qF5YBok5v4Mzzw7vZ3K8G9L7m5J4X5oY8R2j';
const RUNNER_POSITION_MINT = '8M9yXxv7qF5YBok5v4Mzzw7vZ3K8G9L7m5J4X5oY8R2k';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const METADATA_UPDATE_AUTH = '3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr';

type TokenAccountFixture = {
  pubkey: string;
  tokenProgram: string;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmountString?: string;
  state?: string;
  isNative?: boolean;
};

function withParsedTokenOwnerLookup(
  connection: StaticAccountConnection,
  tokenAccounts: TokenAccountFixture[],
): StaticAccountConnection {
  Object.assign(connection, {
    async getParsedTokenAccountsByOwner(owner: PublicKey, filter: { mint?: PublicKey; programId?: PublicKey }) {
      const ownerBase58 = owner.toBase58();
      const filtered = tokenAccounts.filter((entry) => {
        if (entry.owner !== ownerBase58) {
          return false;
        }
        if ('mint' in filter && filter.mint) {
          return entry.mint === filter.mint.toBase58();
        }
        if ('programId' in filter && filter.programId) {
          return entry.tokenProgram === filter.programId.toBase58();
        }
        return true;
      });
      return {
        context: { slot: 1 },
        value: filtered.map((entry) => ({
          pubkey: new PublicKey(entry.pubkey),
          account: {
            owner: entry.tokenProgram,
            data: {
              parsed: {
                info: {
                  mint: entry.mint,
                  owner: entry.owner,
                  tokenAmount: {
                    amount: entry.amount,
                    decimals: entry.decimals,
                    uiAmountString: entry.uiAmountString ?? entry.amount,
                  },
                  state: entry.state ?? 'initialized',
                  isNative: entry.isNative ?? false,
                },
              },
            },
          },
        })),
      };
    },
  });
  return connection;
}

function readAccount(accounts: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = accounts[key];
    if (value !== undefined) {
      return value;
    }
  }
  throw new Error(`Missing expected account key. Tried: ${keys.join(', ')}`);
}

function toCamelOpenPositionAccounts(accounts: Record<string, string>) {
  return {
    funder: createNoopSigner(address(readAccount(accounts, 'funder'))),
    owner: address(readAccount(accounts, 'owner')),
    position: address(readAccount(accounts, 'position')),
    positionMint: createNoopSigner(address(readAccount(accounts, 'positionMint', 'position_mint'))),
    positionTokenAccount: address(readAccount(accounts, 'positionTokenAccount', 'position_token_account')),
    whirlpool: address(readAccount(accounts, 'whirlpool')),
    token2022Program: address(readAccount(accounts, 'token2022Program', 'token2022_program', 'token_2022_program')),
    systemProgram: address(readAccount(accounts, 'systemProgram', 'system_program')),
    associatedTokenProgram: address(readAccount(accounts, 'associatedTokenProgram', 'associated_token_program')),
    metadataUpdateAuth: address(readAccount(accounts, 'metadataUpdateAuth', 'metadata_update_auth')),
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

async function buildToken2022PositionConnection(options?: {
  positionMint?: string;
  tickLowerIndex?: number;
  tickUpperIndex?: number;
  liquidity?: bigint;
}) {
  const positionMint = options?.positionMint ?? POSITION_MINT;
  const tickLowerIndex = options?.tickLowerIndex ?? -64;
  const tickUpperIndex = options?.tickUpperIndex ?? 64;
  const liquidity = options?.liquidity ?? 500000n;
  const connection = new StaticAccountConnection();
  connection.setWhirlpool(
    buildWhirlpoolArgs({
      tickCurrentIndex: 0,
      sqrtPrice: tickIndexToSqrtPrice(0),
    }),
  );

  const [position] = await getPositionAddress(address(positionMint));
  connection.setPosition(
    position,
    buildPositionArgs({
      positionMint,
      tickLowerIndex,
      tickUpperIndex,
      liquidity,
    }),
  );
  connection.setRawAccount(positionMint, TOKEN_2022_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_A, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_B, TOKEN_PROGRAM);

  return { connection, position, positionMint, tickLowerIndex, tickUpperIndex, liquidity };
}

describe('Orca read and runner conformance', () => {
  it('positions_for_owner returns only owned position PDAs backed by wallet token accounts', async () => {
    const connection = new StaticAccountConnection();
    connection.setWhirlpool(buildWhirlpoolArgs());

    const [ownedPosition] = await getPositionAddress(address(POSITION_MINT));
    connection.setPosition(
      ownedPosition,
      buildPositionArgs({
        positionMint: POSITION_MINT,
        liquidity: 42n,
        tickLowerIndex: -128,
        tickUpperIndex: 128,
      }),
    );

    const orphanMint = '9M9yXxv7qF5YBok5v4Mzzw7vZ3K8G9L7m5J4X5oY8R2n';
    const connectionWithTokens = withParsedTokenOwnerLookup(connection, [
      {
        pubkey: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        tokenProgram: TOKEN_PROGRAM,
        mint: POSITION_MINT,
        owner: TEST_WALLET,
        amount: '1',
        decimals: 0,
      },
      {
        pubkey: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
        tokenProgram: TOKEN_PROGRAM,
        mint: orphanMint,
        owner: TEST_WALLET,
        amount: '1',
        decimals: 0,
      },
      {
        pubkey: 'SysvarRent111111111111111111111111111111111',
        tokenProgram: TOKEN_PROGRAM,
        mint: TOKEN_MINT_A,
        owner: TEST_WALLET,
        amount: '5000',
        decimals: 6,
      },
    ]);

    const view = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'positions_for_owner',
      input: {
        owner: TEST_WALLET,
      },
      connection: connectionWithTokens as never,
      walletPublicKey: getTestWallet(),
    });

    expect(view.output).toEqual([
      {
        position: ownedPosition,
        whirlpool: ORCA_WHIRLPOOL,
        positionMint: POSITION_MINT,
        positionOwner: TEST_WALLET,
        liquidity: '42',
        tickLowerIndex: -128,
        tickUpperIndex: 128,
        feeOwedA: '0',
        feeOwedB: '0',
      },
    ]);
  });

  it('quote_close_position drives a full-liquidity decrease draft that matches the Orca SDK instruction', async () => {
    const { connection, position, liquidity } = await buildToken2022PositionConnection({
      liquidity: 987654n,
    });

    const quote = await runRuntimeView({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_close_position',
      input: {
        position,
        slippage_bps: '100',
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const output = quote.output as Record<string, unknown>;
    expect(output.liquidity_amount).toBe(liquidity.toString());
    expect(output.reward_0_active).toBe(true);
    expect(output.reward_1_active).toBe(true);
    expect(output.reward_2_active).toBe(true);

    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'decrease_liquidity_v2',
      input: {
        position,
        liquidity_amount: String(output.liquidity_amount),
        token_min_a: String(output.token_min_a),
        token_min_b: String(output.token_min_b),
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
      liquidityAmount: BigInt(String(output.liquidity_amount)),
      tokenMinA: BigInt(String(output.token_min_a)),
      tokenMinB: BigInt(String(output.token_min_b)),
      remainingAccountsInfo: null,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('open_centered_position_with_liquidity runner wires quote, open, and increase drafts consistently', async () => {
    const { connection } = await buildToken2022PositionConnection({
      positionMint: RUNNER_POSITION_MINT,
      liquidity: 0n,
    });
    const spec = JSON.parse(
      fs.readFileSync(
        new URL('../../../protocol-registry/action-runners/orca.open_centered_position_with_liquidity.runner.json', import.meta.url),
        'utf8',
      ),
    );

    const result = await runActionRunner({
      spec,
      input: {
        whirlpool: ORCA_WHIRLPOOL,
        position_mint: RUNNER_POSITION_MINT,
        tick_offset_steps: '1',
        specified_token_mint: TOKEN_MINT_A,
        specified_token_amount: '1000',
        slippage_bps: '100',
        with_token_metadata_extension: true,
      },
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

    const quote = result.output.quote as Record<string, unknown>;
    const openDraft = result.output.openPositionDraft as Record<string, unknown>;
    const increaseDraft = result.output.increaseLiquidityDraft as Record<string, unknown>;
    const openDraftAccounts = openDraft.accounts as Record<string, string>;
    const increaseDraftAccounts = increaseDraft.accounts as Record<string, string>;
    const [expectedPosition] = await getPositionAddress(address(RUNNER_POSITION_MINT));

    expect(quote.position).toBe(expectedPosition);
    expect(quote.tick_lower_index).toBe('-64');
    expect(quote.tick_upper_index).toBe('64');
    expect(openDraftAccounts.position).toBe(expectedPosition);
    expect(increaseDraftAccounts.position).toBe(expectedPosition);

    const openPreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: String(openDraft.instructionName),
      args: openDraft.args as Record<string, unknown>,
      accounts: openDraftAccounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaOpenInstruction = getOpenPositionWithTokenExtensionsInstruction({
      ...toCamelOpenPositionAccounts(openDraftAccounts),
      tickLowerIndex: Number(quote.tick_lower_index),
      tickUpperIndex: Number(quote.tick_upper_index),
      withTokenMetadataExtension: true,
    });
    expect(openPreview.programId).toBe(orcaOpenInstruction.programAddress);
    expect(Buffer.from(openPreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaOpenInstruction.data));
    expect(openPreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaOpenInstruction.accounts.map((entry) => entry.address),
    );

    const increasePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: String(increaseDraft.instructionName),
      args: increaseDraft.args as Record<string, unknown>,
      accounts: increaseDraftAccounts,
      walletPublicKey: getTestWallet(),
    });
    const quoteStep = result.steps.find((step) => step.id === 'quote');
    const quoteMethod = (quoteStep?.meta as { derived?: { method?: Record<string, unknown> } } | undefined)?.derived
      ?.method;
    expect(quoteMethod).toBeTruthy();
    const orcaIncreaseInstruction = getIncreaseLiquidityByTokenAmountsV2Instruction({
      ...toCamelIncreaseLiquidityAccounts(increaseDraftAccounts),
      method: increaseLiquidityMethod('ByTokenAmounts', {
        tokenMaxA: BigInt(String(quoteMethod?.tokenMaxA)),
        tokenMaxB: BigInt(String(quoteMethod?.tokenMaxB)),
        minSqrtPrice: BigInt(String(quoteMethod?.minSqrtPrice)),
        maxSqrtPrice: BigInt(String(quoteMethod?.maxSqrtPrice)),
      }),
      remainingAccountsInfo: null,
    });
    expect(increasePreview.programId).toBe(orcaIncreaseInstruction.programAddress);
    expect(Buffer.from(increasePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaIncreaseInstruction.data));
    expect(increasePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaIncreaseInstruction.accounts.map((entry) => entry.address),
    );

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(RUNNER_POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_2022_PROGRAM),
    ).toBase58();
    expect(openDraftAccounts.position_token_account).toBe(expectedPositionTokenAccount);
    expect(openDraftAccounts.associated_token_program).toBe(ASSOCIATED_TOKEN_PROGRAM);
    expect(openDraftAccounts.metadata_update_auth).toBe(METADATA_UPDATE_AUTH);
  });
});
