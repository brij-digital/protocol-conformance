import path from 'node:path';
import { PublicKey } from '@solana/web3.js';
import type { TickArrayArgs, WhirlpoolArgs } from '@orca-so/whirlpools-client';
import {
  encodeTickArrayAccount,
  encodeWhirlpoolAccount,
  ORCA_PROGRAM_ID,
  ORCA_WHIRLPOOL,
  TEST_WALLET,
} from '../fixtures/orca.js';

process.env.APPPACK_RUNTIME_REGISTRY_PATH = path.resolve(
  '/Users/antoine/Documents/github/Espresso Cash/ec-ai-wallet/public/idl/registry.json',
);

export class StaticAccountConnection {
  private readonly accounts = new Map<string, Buffer>();

  setWhirlpool(args: WhirlpoolArgs): void {
    this.accounts.set(ORCA_WHIRLPOOL, encodeWhirlpoolAccount(args));
  }

  setTickArray(address: string, args: TickArrayArgs): void {
    this.accounts.set(address, encodeTickArrayAccount(args));
  }

  async getAccountInfo(address: PublicKey | string): Promise<{
    data: Buffer;
    owner: PublicKey;
    executable: boolean;
    lamports: number;
    rentEpoch: number;
  } | null> {
    const key = typeof address === 'string' ? address : address.toBase58();
    const data = this.accounts.get(key);
    if (!data) {
      return null;
    }
    return {
      data,
      owner: new PublicKey(ORCA_PROGRAM_ID),
      executable: false,
      lamports: 0,
      rentEpoch: 0,
    };
  }
}

export function getTestWallet(): PublicKey {
  return new PublicKey(TEST_WALLET);
}
