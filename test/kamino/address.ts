import { address, type Address } from '@solana/kit';

export function asAddress(value: string): Address {
  return address(value);
}

export function instructionDataAsBuffer(data: ArrayLike<number> | undefined): Buffer {
  if (!data) {
    throw new Error('Expected SDK instruction data to be defined.');
  }
  return Buffer.from(data);
}
