export {};

declare global {
  interface Window {
    psystat?: {
      engineUrl: string;
      clipboardWrite?: (text: string) => void;
      clipboardRead?: () => string;
    };
  }
}
