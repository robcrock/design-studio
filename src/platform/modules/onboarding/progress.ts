// Browser completion provides a fallback for unavailable local persistence.
import { callModule, ClientError } from '#studio/data';
const completed = new Set<string>();
const claims = new Map<string, Promise<boolean>>();
type StorageSource = () => Pick<Storage, 'getItem' | 'setItem'>;
export function progressKey(base: string, contributor: string | null = null) {
  return `design-studio:onboarding:${base}:${contributor ?? 'unregistered'}:v3`;
}

export function isComplete(key: string, storage: StorageSource = () => localStorage) {
  if (completed.has(key)) return true;
  try {
    return storage().getItem(key) === 'complete';
  } catch {
    return false;
  }
}

export function complete(key: string, storage: StorageSource = () => localStorage) {
  completed.add(key);
  try {
    storage().setItem(key, 'complete');
    return true;
  } catch {
    return false;
  }
}

// Share the initial request across StrictMode effect replay. Disk state survives origins and restarts.
export function claimIntroduction(
  key: string,
  identityReady: boolean,
  automated = globalThis.navigator?.webdriver === true,
) {
  // Never consume the server claim or cache a result for an identity that is still loading.
  // An agent's automated browser acts as the same contributor; it must not use up the person's one Welcome.
  if (!identityReady || automated) return Promise.resolve(false);
  let claim = claims.get(key);
  if (!claim) {
    claim = callModule<{ show: boolean | null }>('onboarding', 'progress', { action: 'claim' })
      .then(result => {
        if (!result || !Object.hasOwn(result, 'show') || (result.show !== null && typeof result.show !== 'boolean'))
          throw new ClientError('invalid_response', 'Onboarding progress must declare show as a boolean or null.');
        return result.show === null ? !isComplete(key) : result.show;
      })
      .catch(error => {
        if (error instanceof ClientError && error.status === 422) return false;
        // Unavailable persistence may use browser completion; malformed successful replies need correction.
        if (
          error instanceof ClientError &&
          error.code === 'invalid_response' &&
          (error.status === undefined || (error.status >= 200 && error.status < 300))
        )
          throw error;
        return !isComplete(key);
      });
    claims.set(key, claim);
  }
  return claim;
}

export function recordIntroduction(key: string) {
  claims.set(key, Promise.resolve(false));
  complete(key);
}
