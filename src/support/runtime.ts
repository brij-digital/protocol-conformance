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
} from '../../test/orca/fixtures.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

process.env.APPPACK_RUNTIME_REGISTRY_PATH = path.resolve(
  moduleDir,
  '../../../protocol-registry/registry.json',
);

type StoredAccount = { data: Uint8Array; owner: string };
type Web3AccountInfo = {
  data: Uint8Array;
  owner: PublicKey;
  executable: boolean;
  lamports: number;
  rentEpoch: number;
};
type RpcAccountInfo = {
  data: [string, 'base64'];
  owner: string;
  executable: boolean;
  lamports: number;
  rentEpoch: bigint;
  space: bigint;
};

function decodeMemcmpBytes(bytes: string, encoding?: string): Uint8Array {
  if (encoding === 'base64') {
    return Uint8Array.from(Buffer.from(bytes, 'base64'));
  }
  try {
    return new PublicKey(bytes).toBytes();
  } catch {
    return new TextEncoder().encode(bytes);
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function asBigInt(value: bigint | number | undefined): bigint | undefined {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  return undefined;
}

export class StaticAccountConnection {
  private readonly accounts = new Map<string, StoredAccount>();
  private slot = 0n;

  setSlot(slot: bigint | number): void {
    this.slot = typeof slot === 'bigint' ? slot : BigInt(slot);
  }

  setRawAccount(address: string, owner: string, data: Uint8Array = new Uint8Array()): void {
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

  private getEntry(address: PublicKey | string): StoredAccount | null {
    const key = typeof address === 'string' ? address : address.toBase58();
    return this.accounts.get(key) ?? null;
  }

  private toWeb3AccountInfo(entry: StoredAccount | null): Web3AccountInfo | null {
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

  private toRpcAccountInfo(entry: StoredAccount | null): RpcAccountInfo | null {
    if (!entry) {
      return null;
    }
    return {
      data: [Buffer.from(entry.data).toString('base64'), 'base64'],
      owner: entry.owner,
      executable: false,
      lamports: 0,
      rentEpoch: 0n,
      space: BigInt(entry.data.length),
    };
  }

  private createRpcRequest<TDirect, TSend>(direct: () => Promise<TDirect>, send: () => Promise<TSend>) {
    const directPromise = direct();
    return {
      send,
      then: directPromise.then.bind(directPromise),
      catch: directPromise.catch.bind(directPromise),
      finally: directPromise.finally.bind(directPromise),
    };
  }

  getAccountInfo(address: PublicKey | string): Promise<Web3AccountInfo | null>;
  getAccountInfo(address: PublicKey | string, _config: unknown): {
    send: () => Promise<{ context: { slot: bigint }; value: RpcAccountInfo | null }>;
    then: Promise<Web3AccountInfo | null>['then'];
    catch: Promise<Web3AccountInfo | null>['catch'];
    finally: Promise<Web3AccountInfo | null>['finally'];
  };
  getAccountInfo(address: PublicKey | string, config?: unknown) {
    if (config !== undefined) {
      return this.createRpcRequest(
        async () => this.toWeb3AccountInfo(this.getEntry(address)),
        async () => ({
          context: { slot: this.slot },
          value: this.toRpcAccountInfo(this.getEntry(address)),
        }),
      );
    }
    return Promise.resolve(this.toWeb3AccountInfo(this.getEntry(address)));
  }

  getMultipleAccounts(addresses: ReadonlyArray<PublicKey | string>, _config?: unknown) {
    return this.createRpcRequest(
      async () => addresses.map((address) => this.toWeb3AccountInfo(this.getEntry(address))),
      async () => ({
        context: { slot: this.slot },
        value: addresses.map((address) => this.toRpcAccountInfo(this.getEntry(address))),
      }),
    );
  }

  getProgramAccounts(programId: PublicKey | string, config?: {
    filters?: Array<{
      dataSize?: bigint | number;
      memcmp?: { offset: bigint | number; bytes: string; encoding?: string };
    }>;
  }) {
    const owner = typeof programId === 'string' ? programId : programId.toBase58();
    return this.createRpcRequest(
      async () => this.collectProgramAccounts(owner, config?.filters),
      async () => this.collectProgramAccounts(owner, config?.filters),
    );
  }

  getSlot() {
    return this.createRpcRequest(async () => this.slot, async () => this.slot);
  }

  private collectProgramAccounts(
    owner: string,
    filters?: Array<{
      dataSize?: bigint | number;
      memcmp?: { offset: bigint | number; bytes: string; encoding?: string };
    }>,
  ) {
    const entries = [...this.accounts.entries()]
      .filter(([, entry]) => entry.owner === owner)
      .filter(([, entry]) => this.matchesFilters(entry.data, filters))
      .map(([pubkey, entry]) => ({
        pubkey,
        account: this.toRpcAccountInfo(entry),
      }));
    return Promise.resolve(entries);
  }

  private matchesFilters(
    data: Uint8Array,
    filters?: Array<{
      dataSize?: bigint | number;
      memcmp?: { offset: bigint | number; bytes: string; encoding?: string };
    }>,
  ): boolean {
    if (!filters || filters.length === 0) {
      return true;
    }
    return filters.every((filter) => {
      const dataSize = asBigInt(filter.dataSize);
      if (dataSize !== undefined && BigInt(data.length) !== dataSize) {
        return false;
      }
      if (!filter.memcmp) {
        return true;
      }
      const offset = Number(asBigInt(filter.memcmp.offset) ?? 0n);
      const expected = decodeMemcmpBytes(filter.memcmp.bytes, filter.memcmp.encoding);
      return bytesEqual(data.subarray(offset, offset + expected.length), expected);
    });
  }
}

export function getTestWallet(): PublicKey {
  return new PublicKey(TEST_WALLET);
}
