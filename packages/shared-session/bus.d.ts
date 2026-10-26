export function publish(type: string, payload?: unknown): void;
export function subscribe(type: string, handler: (payload: unknown) => void): () => void;
