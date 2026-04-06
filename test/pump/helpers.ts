import fs from 'node:fs';
import { runRegisteredComputeStep } from '@brij-digital/apppack-runtime';
import { PublicKey, type TransactionInstruction } from '@solana/web3.js';
import { getTestWallet, StaticAccountConnection } from '../../src/support/runtime.js';

type JsonRecord = Record<string, unknown>;

type TransformStep = {
  name: string;
  kind: string;
  [key: string]: unknown;
};

type RuntimePack = {
  transforms: Record<string, TransformStep[]>;
};

const runtimeExecutorBase = {
  protocolId: 'pump-test',
  programId: '',
  connection: new StaticAccountConnection() as unknown,
  walletPublicKey: getTestWallet(),
  idl: {},
  previewInstruction: async () => ({
    programId: '',
    dataBase64: '',
    keys: [],
  }),
};

export function loadRuntimePack(relativePath: string): RuntimePack {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as RuntimePack;
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must resolve to an object.`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must resolve to a string.`);
  }
  return value;
}

function normalizeRuntimeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeRuntimeValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nested]) => [key, normalizeRuntimeValue(nested)]),
    );
  }
  return value;
}

function resolvePath(scope: JsonRecord, path: string): unknown {
  const cleaned = path.startsWith('$') ? path.slice(1) : path;
  const parts = cleaned.split('.').filter(Boolean);
  let current: unknown = scope;
  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      throw new Error(`Cannot resolve path ${path}.`);
    }
    current = (current as JsonRecord)[part];
  }
  if (current === undefined) {
    throw new Error(`Cannot resolve path ${path}.`);
  }
  return current;
}

function resolveTemplateValue(value: unknown, scope: JsonRecord): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    return resolvePath(scope, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, scope));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, nested]) => [key, resolveTemplateValue(nested, scope)]),
    );
  }
  return value;
}

async function runComputeStep(
  step: TransformStep,
  scope: JsonRecord,
  runtimePack: RuntimePack,
  programId: string,
): Promise<unknown> {
  if (step.kind === 'transform') {
    const transformName = asString(step.transform, `compute:${step.name}:transform`);
    const nested = runtimePack.transforms[transformName];
    if (!nested) {
      throw new Error(`Transform ${transformName} not found.`);
    }
    await runNestedTransformSteps(nested, scope, runtimePack, programId);
    return scope.derived;
  }
  const resolvedStep = asRecord(
    normalizeRuntimeValue(resolveTemplateValue(step, scope)),
    `compute:${step.name}`,
  );
  const kind = asString(resolvedStep.kind, `compute:${step.name}:kind`);
  return runRegisteredComputeStep(
    { ...resolvedStep, name: step.name, kind },
    {
      ...runtimeExecutorBase,
      programId,
      scope,
    } as never,
  );
}

async function runNestedTransformSteps(
  steps: TransformStep[],
  scope: JsonRecord,
  runtimePack: RuntimePack,
  programId: string,
): Promise<void> {
  const derived = (scope.derived as JsonRecord | undefined) ?? {};
  scope.derived = derived;
  for (const step of steps) {
    const value = await runComputeStep(step, scope, runtimePack, programId);
    derived[step.name] = normalizeRuntimeValue(value);
    scope[step.name] = normalizeRuntimeValue(value);
  }
}

export async function executeTransform(options: {
  runtimePack: RuntimePack;
  transformName: string;
  bindings: Record<string, unknown>;
  programId: string;
}) {
  const normalizedBindings = normalizeRuntimeValue(options.bindings) as JsonRecord;
  const scope: JsonRecord = {
    runtime: options.runtimePack,
    ...normalizedBindings,
  };
  await runNestedTransformSteps(
    options.runtimePack.transforms[options.transformName],
    scope,
    options.runtimePack,
    options.programId,
  );
  return scope.derived as JsonRecord;
}

export function lastInstruction(instructions: TransactionInstruction[]): TransactionInstruction {
  const instruction = instructions.at(-1);
  if (!instruction) {
    throw new Error('Expected at least one SDK instruction.');
  }
  return instruction;
}

export function instructionPubkeys(instruction: TransactionInstruction): string[] {
  return instruction.keys.map((entry) => entry.pubkey.toBase58());
}

export function toComparable(value: unknown): unknown {
  return normalizeRuntimeValue(value);
}

export function pubkey(value: string): PublicKey {
  return new PublicKey(value);
}
