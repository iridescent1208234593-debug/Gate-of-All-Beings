export type EntryRoute = 'wait' | 'onboarding' | 'door';

export function resolveEntryRoute(input: {
  loading: boolean;
  resolved: boolean;
  creatingNew: boolean;
  identityComplete: boolean;
}): EntryRoute {
  if (input.loading || !input.resolved) return 'wait';
  return input.creatingNew || !input.identityComplete ? 'onboarding' : 'door';
}
