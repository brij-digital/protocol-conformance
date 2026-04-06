import { describe, expect, it } from 'vitest';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import {
  getClosePositionWithTokenExtensionsInstruction,
  getOpenPositionWithTokenExtensionsInstruction,
  getPositionAddress,
  type WhirlpoolArgs,
} from '@orca-so/whirlpools-client';
import {
  decreaseLiquidityQuoteA,
  decreaseLiquidityQuoteB,
  increaseLiquidityQuoteA,
  increaseLiquidityQuoteB,
  tickIndexToSqrtPrice,
} from '@orca-so/whirlpools-core';
import {
  explainRuntimeOperation,
  prepareRuntimeInstruction,
  previewIdlInstruction,
  runRuntimeView,
} from '@brij-digital/apppack-runtime';
import { address, createNoopSigner } from '@solana/kit';
import {
  buildPositionArgs,
  buildWhirlpoolArgs,
  ORCA_WHIRLPOOL,
  TEST_WALLET,
  TOKEN_MINT_A,
  TOKEN_MINT_B,
  TOKEN_PROGRAM,
} from './fixtures.js';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const METADATA_UPDATE_AUTH = '3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr';
const OPEN_POSITION_MINT = '3M9yXxv7qF5YBok5v4Mzzw7vZ3K8G9L7m5J4X5oY8R2j';
const CLOSE_POSITION_MINT = '6q5ZGhEj6UKW8YJrr3E8m3JY9P8k2v6Z7bGqQ1h7i3Fo';

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
    positionTokenAccount: address(
      readAccount(accounts, 'positionTokenAccount', 'position_token_account'),
    ),
    whirlpool: address(readAccount(accounts, 'whirlpool')),
    token2022Program: address(
      readAccount(accounts, 'token2022Program', 'token2022_program', 'token_2022_program'),
    ),
    systemProgram: address(readAccount(accounts, 'systemProgram', 'system_program')),
    associatedTokenProgram: address(
      readAccount(accounts, 'associatedTokenProgram', 'associated_token_program'),
    ),
    metadataUpdateAuth: address(readAccount(accounts, 'metadataUpdateAuth', 'metadata_update_auth')),
  };
}

function toCamelClosePositionAccounts(accounts: Record<string, string>) {
  return {
    positionAuthority: createNoopSigner(
      address(readAccount(accounts, 'positionAuthority', 'position_authority')),
    ),
    receiver: address(readAccount(accounts, 'receiver')),
    position: address(readAccount(accounts, 'position')),
    positionMint: address(readAccount(accounts, 'positionMint', 'position_mint')),
    positionTokenAccount: address(
      readAccount(accounts, 'positionTokenAccount', 'position_token_account'),
    ),
    token2022Program: address(
      readAccount(accounts, 'token2022Program', 'token2022_program', 'token_2022_program'),
    ),
  };
}

async function buildToken2022PositionConnection(options?: {
  positionMint?: string;
  tickLowerIndex?: number;
  tickUpperIndex?: number;
  whirlpoolArgs?: WhirlpoolArgs;
}) {
  const positionMint = options?.positionMint ?? CLOSE_POSITION_MINT;
  const tickLowerIndex = options?.tickLowerIndex ?? -64;
  const tickUpperIndex = options?.tickUpperIndex ?? 64;
  const connection = new StaticAccountConnection();
  connection.setWhirlpool(
    options?.whirlpoolArgs ??
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
    }),
  );
  connection.setRawAccount(positionMint, TOKEN_2022_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_A, TOKEN_PROGRAM);
  connection.setRawAccount(TOKEN_MINT_B, TOKEN_PROGRAM);

  return { connection, position, positionMint, tickLowerIndex, tickUpperIndex };
}

async function expectQuoteIncreaseParity(options: {
  currentTickIndex: number;
  specifiedTokenMint: string;
  specifiedTokenAmount: string;
}) {
  const whirlpoolArgs = buildWhirlpoolArgs({
    tickCurrentIndex: options.currentTickIndex,
    sqrtPrice: tickIndexToSqrtPrice(options.currentTickIndex),
  });
  const { connection, position } = await buildToken2022PositionConnection({ whirlpoolArgs });
  const view = await runRuntimeView({
    protocolId: 'orca-whirlpool-mainnet',
    operationId: 'quote_increase_liquidity',
    input: {
      position,
      specified_token_mint: options.specifiedTokenMint,
      specified_token_amount: options.specifiedTokenAmount,
      slippage_bps: '100',
    },
    connection: connection as never,
    walletPublicKey: getTestWallet(),
  });
  const output = view.output as Record<string, unknown>;
  const quote =
    options.specifiedTokenMint === TOKEN_MINT_A
      ? increaseLiquidityQuoteA(
          BigInt(options.specifiedTokenAmount),
          100,
          BigInt(whirlpoolArgs.sqrtPrice),
          -64,
          64,
        )
      : increaseLiquidityQuoteB(
          BigInt(options.specifiedTokenAmount),
          100,
          BigInt(whirlpoolArgs.sqrtPrice),
          -64,
          64,
        );

  expect(output.position).toBe(position);
  expect(output.whirlpool).toBe(ORCA_WHIRLPOOL);
  expect(output.specified_token_mint).toBe(options.specifiedTokenMint);
  expect(output.specified_token_amount).toBe(options.specifiedTokenAmount);
  expect(output.liquidity_delta).toBe(BigInt(quote.liquidityDelta).toString());
  expect(output.token_est_a).toBe(BigInt(quote.tokenEstA).toString());
  expect(output.token_est_b).toBe(BigInt(quote.tokenEstB).toString());
  expect(output.token_max_a).toBe(BigInt(quote.tokenMaxA).toString());
  expect(output.token_max_b).toBe(BigInt(quote.tokenMaxB).toString());
}

async function expectQuoteDecreaseParity(options: {
  currentTickIndex: number;
  specifiedTokenMint: string;
  specifiedTokenAmount: string;
}) {
  const whirlpoolArgs = buildWhirlpoolArgs({
    tickCurrentIndex: options.currentTickIndex,
    sqrtPrice: tickIndexToSqrtPrice(options.currentTickIndex),
  });
  const { connection, position } = await buildToken2022PositionConnection({ whirlpoolArgs });
  const view = await runRuntimeView({
    protocolId: 'orca-whirlpool-mainnet',
    operationId: 'quote_decrease_liquidity',
    input: {
      position,
      specified_token_mint: options.specifiedTokenMint,
      specified_token_amount: options.specifiedTokenAmount,
      slippage_bps: '100',
    },
    connection: connection as never,
    walletPublicKey: getTestWallet(),
  });
  const output = view.output as Record<string, unknown>;
  const quote =
    options.specifiedTokenMint === TOKEN_MINT_A
      ? decreaseLiquidityQuoteA(
          BigInt(options.specifiedTokenAmount),
          100,
          BigInt(whirlpoolArgs.sqrtPrice),
          -64,
          64,
        )
      : decreaseLiquidityQuoteB(
          BigInt(options.specifiedTokenAmount),
          100,
          BigInt(whirlpoolArgs.sqrtPrice),
          -64,
          64,
        );

  expect(output.position).toBe(position);
  expect(output.whirlpool).toBe(ORCA_WHIRLPOOL);
  expect(output.specified_token_mint).toBe(options.specifiedTokenMint);
  expect(output.specified_token_amount).toBe(options.specifiedTokenAmount);
  expect(output.liquidity_delta).toBe(BigInt(quote.liquidityDelta).toString());
  expect(output.token_est_a).toBe(BigInt(quote.tokenEstA).toString());
  expect(output.token_est_b).toBe(BigInt(quote.tokenEstB).toString());
  expect(output.token_min_a).toBe(BigInt(quote.tokenMinA).toString());
  expect(output.token_min_b).toBe(BigInt(quote.tokenMinB).toString());
}

describe('Orca LP runtime operations', () => {
  it('exposes the LP runtime surface added for position lifecycle and liquidity quotes', async () => {
    const open = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'open_position',
    });
    const close = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'close_position',
    });
    const quoteIncrease = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_increase_liquidity',
    });
    const quoteDecrease = await explainRuntimeOperation({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'quote_decrease_liquidity',
    });

    expect(open.operationKind).toBe('write');
    expect(open.instruction).toBe('open_position_with_token_extensions');
    expect(close.operationKind).toBe('write');
    expect(close.instruction).toBe('close_position_with_token_extensions');
    expect(quoteIncrease.operationKind).toBe('view');
    expect(quoteDecrease.operationKind).toBe('view');
  });

  it('matches Orca account derivation for open_position', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'open_position',
      input: {
        whirlpool: ORCA_WHIRLPOOL,
        position_mint: OPEN_POSITION_MINT,
        tick_lower_index: -64,
        tick_upper_index: 64,
        with_token_metadata_extension: true,
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const [expectedPosition] = await getPositionAddress(address(OPEN_POSITION_MINT));
    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(OPEN_POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_2022_PROGRAM),
    ).toBase58();

    expect(prepared.accounts.funder).toBe(TEST_WALLET);
    expect(prepared.accounts.owner).toBe(TEST_WALLET);
    expect(prepared.accounts.position).toBe(expectedPosition);
    expect(readAccount(prepared.accounts, 'positionMint', 'position_mint')).toBe(OPEN_POSITION_MINT);
    expect(readAccount(prepared.accounts, 'positionTokenAccount', 'position_token_account')).toBe(
      expectedPositionTokenAccount,
    );
    expect(readAccount(prepared.accounts, 'token2022Program', 'token2022_program', 'token_2022_program')).toBe(
      TOKEN_2022_PROGRAM,
    );
    expect(readAccount(prepared.accounts, 'systemProgram', 'system_program')).toBe(
      PublicKey.default.toBase58(),
    );
    expect(readAccount(prepared.accounts, 'associatedTokenProgram', 'associated_token_program')).toBe(
      ASSOCIATED_TOKEN_PROGRAM,
    );
    expect(readAccount(prepared.accounts, 'metadataUpdateAuth', 'metadata_update_auth')).toBe(
      METADATA_UPDATE_AUTH,
    );
  });

  it('matches Orca instruction encoding for open_position', async () => {
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'open_position',
      input: {
        whirlpool: ORCA_WHIRLPOOL,
        position_mint: OPEN_POSITION_MINT,
        tick_lower_index: -64,
        tick_upper_index: 64,
        with_token_metadata_extension: true,
      },
      connection: {} as never,
      walletPublicKey: getTestWallet(),
    });

    const runtimePreview = await previewIdlInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      instructionName: prepared.instructionName,
      args: prepared.args,
      accounts: prepared.accounts,
      walletPublicKey: getTestWallet(),
    });
    const orcaInstruction = getOpenPositionWithTokenExtensionsInstruction({
      ...toCamelOpenPositionAccounts(prepared.accounts),
      tickLowerIndex: -64,
      tickUpperIndex: 64,
      withTokenMetadataExtension: true,
    });

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches Orca account derivation for close_position', async () => {
    const { connection, position } = await buildToken2022PositionConnection();
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'close_position',
      input: {
        position,
      },
      connection: connection as never,
      walletPublicKey: getTestWallet(),
    });

    const expectedPositionTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(CLOSE_POSITION_MINT),
      new PublicKey(TEST_WALLET),
      false,
      new PublicKey(TOKEN_2022_PROGRAM),
    ).toBase58();

    expect(readAccount(prepared.accounts, 'positionAuthority', 'position_authority')).toBe(TEST_WALLET);
    expect(prepared.accounts.receiver).toBe(TEST_WALLET);
    expect(prepared.accounts.position).toBe(position);
    expect(readAccount(prepared.accounts, 'positionMint', 'position_mint')).toBe(CLOSE_POSITION_MINT);
    expect(readAccount(prepared.accounts, 'positionTokenAccount', 'position_token_account')).toBe(
      expectedPositionTokenAccount,
    );
    expect(readAccount(prepared.accounts, 'token2022Program', 'token2022_program', 'token_2022_program')).toBe(
      TOKEN_2022_PROGRAM,
    );
  });

  it('matches Orca instruction encoding for close_position', async () => {
    const { connection, position } = await buildToken2022PositionConnection();
    const prepared = await prepareRuntimeInstruction({
      protocolId: 'orca-whirlpool-mainnet',
      operationId: 'close_position',
      input: {
        position,
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
    const orcaInstruction = getClosePositionWithTokenExtensionsInstruction(
      toCamelClosePositionAccounts(prepared.accounts),
    );

    expect(runtimePreview.programId).toBe(orcaInstruction.programAddress);
    expect(Buffer.from(runtimePreview.dataBase64, 'base64')).toEqual(Buffer.from(orcaInstruction.data));
    expect(runtimePreview.keys.map((entry) => entry.pubkey)).toEqual(
      orcaInstruction.accounts.map((entry) => entry.address),
    );
  });

  it('matches increase liquidity quote parity for token A in range', async () => {
    await expectQuoteIncreaseParity({
      currentTickIndex: 0,
      specifiedTokenMint: TOKEN_MINT_A,
      specifiedTokenAmount: '100',
    });
  });

  it('matches increase liquidity quote parity for token B in range', async () => {
    await expectQuoteIncreaseParity({
      currentTickIndex: 0,
      specifiedTokenMint: TOKEN_MINT_B,
      specifiedTokenAmount: '100',
    });
  });

  it('matches increase liquidity quote parity for token A below range', async () => {
    await expectQuoteIncreaseParity({
      currentTickIndex: -128,
      specifiedTokenMint: TOKEN_MINT_A,
      specifiedTokenAmount: '100',
    });
  });

  it('matches increase liquidity quote parity for token B above range', async () => {
    await expectQuoteIncreaseParity({
      currentTickIndex: 128,
      specifiedTokenMint: TOKEN_MINT_B,
      specifiedTokenAmount: '100',
    });
  });

  it('matches decrease liquidity quote parity for token A in range', async () => {
    await expectQuoteDecreaseParity({
      currentTickIndex: 0,
      specifiedTokenMint: TOKEN_MINT_A,
      specifiedTokenAmount: '100',
    });
  });

  it('matches decrease liquidity quote parity for token B in range', async () => {
    await expectQuoteDecreaseParity({
      currentTickIndex: 0,
      specifiedTokenMint: TOKEN_MINT_B,
      specifiedTokenAmount: '100',
    });
  });

  it('matches decrease liquidity quote parity for token A below range', async () => {
    await expectQuoteDecreaseParity({
      currentTickIndex: -128,
      specifiedTokenMint: TOKEN_MINT_A,
      specifiedTokenAmount: '100',
    });
  });

  it('matches decrease liquidity quote parity for token B above range', async () => {
    await expectQuoteDecreaseParity({
      currentTickIndex: 128,
      specifiedTokenMint: TOKEN_MINT_B,
      specifiedTokenAmount: '100',
    });
  });
});
