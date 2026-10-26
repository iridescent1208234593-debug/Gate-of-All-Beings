export function readNamespace():Record<string,unknown>;
export function writeNamespace(data:Record<string,unknown>):void;
export function unifiedStorage(module: string): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
};
