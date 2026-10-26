export {};

declare global {
  interface Window {
    LXHIntro: {
      formatTime(value: number): string;
      progress(value: number, duration: number): number;
      syncProgress(range: HTMLInputElement | null, value: number, duration: number): void;
      bindSeek(range: HTMLInputElement | null, handlers: {
        start?: (event: Event) => void;
        input?: (value: number, event: Event) => void;
        end?: (event: Event) => void;
      }): () => void;
      bindSkip(button: HTMLButtonElement | null, onSkip: (event: Event) => void): () => void;
    };
  }
}
