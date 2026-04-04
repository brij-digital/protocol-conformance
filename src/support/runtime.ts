import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import type { PositionArgs, TickArrayArgs, WhirlpoolArgs } from '@orca-so/whirlpools-client';
import {
  encodePositionAccount,
  encodeTickArrayAccount,
  encodeWhirlpoolAccount,
  ORCA_PROGRAM_ID,
  ORCA_WHIRLPOOL,
  TEST_WALLET,
} from '../fixtures/orca.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

process.env.APPPACK_RUNTIME_REGISTRY_PATH = path.resolve(
  moduleDir,
  '../../../ec-ai-wallet/public/idl/registry.json',
);

export class StaticAccountConnection {
  private readonly accounts = new Map<string, { data: Buffer; owner: string }>();

  setRawAccount(address: string, owner: string, data: Buffer = Buffer.alloc(0)): void {
    this.accounts.set(address, { data, owner });
  }

  setWhirlpool(args: WhirlpoolArgs): void {
    this.setWhirlpoolAt(ORCA_WHIRLPOOL, args);
  }

  setWhirlpoolAt(address: string, args: WhirlpoolArgs): void {
    this.setRawAccount(address, ORCA_PROGRAM_ID, encodeWhirlpoolAccount(args));
  }

  setTickArray(address: string, args: TickArrayArgs): void {
    this.setRawAccount(address, ORCA_PROGRAM_ID, encodeTickArrayAccount(args));
  }

  setPosition(address: string, args: PositionArgs): void {
    this.setRawAccount(address, ORCA_PROGRAM_ID, encodePositionAccount(args));
  }

  async getAccountInfo(address: PublicKey | string): Promise<{
    data: Buffer;
    owner: PublicKey;
    executable: boolean;
    lamports: number;
    rentEpoch: number;
  } | null> {
    const key = typeof address === 'string' ? address : address.toBase58();
    const entry = this.accounts.get(key);
    if (!entry) {
      return null;
    }
    return {
      data: entry.data,
      owner: new PublicKey(entry.owner),
      executable: false,
      lamports: 0,
      rentEpoch: 0,
    };
  }
}

export function getTestWallet(): PublicKey {
  return new PublicKey(TEST_WALLET);
}
