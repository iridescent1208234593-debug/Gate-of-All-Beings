export const SCHEMA_VERSION: number;
export function readSave(): Record<string, unknown>;
export function get(key: string): unknown;
export function set(key: string, value: unknown): Record<string, unknown>;
export function patch(values: Record<string, unknown>): Record<string, unknown>;
export function onSave(handler: (payload: unknown) => void): () => void;
export function clear(): void;
