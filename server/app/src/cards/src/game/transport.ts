import type { Action, RunState, TimelineAnchor } from './core/types';
import { reduceRun } from './core/engine';
export interface IGameTransport<T extends RunState = RunState> { snapshot(): T; dispatch(action: Action): T; }
/** One authoritative reducer, ready to run on a server. Never expose hidden decks to opponents. */
export class LocalTransport<T extends RunState = RunState> implements IGameTransport<T> {
  constructor(private state: T, private timeline: TimelineAnchor) {}
  snapshot() {return structuredClone(this.state);}
  dispatch(action: Action) {this.state=reduceRun(this.state,action,this.timeline);return this.snapshot();}
}
