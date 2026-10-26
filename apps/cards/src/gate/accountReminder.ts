/** Re-check the shared account session after onboarding; the previous account
 * state is itself server-derived and is used only if this extra check fails. */
export async function needsAccountAfterOnboarding(knownLoggedIn: boolean, request: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await request('/api/sso-user', { credentials: 'same-origin', cache: 'no-store' });
    if (response.ok) return (await response.json()).logged_in === false;
  } catch { /* Keep the last server-verified account state when temporarily offline. */ }
  return !knownLoggedIn;
}
