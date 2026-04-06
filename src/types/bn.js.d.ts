declare module 'bn.js' {
  class BN {
    constructor(value?: string | number | bigint | BN, base?: number | 'hex', endian?: 'le' | 'be');
    static isBN(value: unknown): value is BN;
    toString(base?: number | 'hex', padding?: number): string;
    toNumber(): number;
    toArrayLike<T extends typeof Uint8Array | typeof Buffer>(
      arrayType: T,
      endian?: 'le' | 'be',
      length?: number,
    ): InstanceType<T>;
    isNeg(): boolean;
    toTwos(width: number): BN;
    add(value: BN): BN;
    sub(value: BN): BN;
    mul(value: BN): BN;
    div(value: BN): BN;
  }

  export = BN;
}
