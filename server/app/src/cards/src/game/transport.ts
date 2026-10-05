import type { Action, RunState, TimelineAnchor } from './core/types';
import { reduceRun } from './core/engine';
export interface IGameTransport { snapshot(): RunState; dispatch(action: Action): RunState; }
/** One authoritative reducer, ready to run on a server. Never expose hidden decks to opponents. */
export class LocalTransport implements IGameTransport {
  constructor(private state: RunState, private timeline: TimelineAnchor) {}
  snapshot() {return structuredClone(this.state);}
  dispatch(action: Action) {this.state=reduceRun(this.state,action,this.timeline);return this.snapshot();}
}
