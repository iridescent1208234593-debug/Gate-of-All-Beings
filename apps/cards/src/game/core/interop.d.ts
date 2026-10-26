// The integration tests exercise JavaScript simulation projects through their JSON boundary.
declare module '*ecology/src/core/state.js' {
  export function createInitialState(seed?: number): any;
  export function reducer(state: any, action: any): any;
}
declare module '*management/src/core/gameState.js' {
  export function createInitialState(): any;
}
declare module '*management/src/systems/ecology.js' {
  export function importEcology(state: any, packet: unknown): any;
}
