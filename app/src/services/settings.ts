import {DEFAULT_REGION} from '../config';
import {Provider, Settings} from '../types.live';
import {readJson, storageKey, writeJson} from './storage';

const SETTINGS_KEY = storageKey('settings');

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  region: DEFAULT_REGION,
  providerIds: [],
  initialized: false,
};

function isValidSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Settings>;
  return (
    candidate.version === 1 &&
    typeof candidate.region === 'string' &&
    Array.isArray(candidate.providerIds) &&
    candidate.providerIds.every((id) => typeof id === 'number') &&
    typeof candidate.initialized === 'boolean'
  );
}

export async function loadSettings(): Promise<Settings> {
  const stored = await readJson<unknown>(SETTINGS_KEY, null);
  if (!isValidSettings(stored)) {
    return {...DEFAULT_SETTINGS};
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    region: stored.region || DEFAULT_REGION,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeJson(SETTINGS_KEY, settings);
}

/**
 * First-run defaults: the five most prominent India providers. Deliberately
 * derived from TMDB's display_priority rather than a hardcoded brand list.
 */
export function pickDefaultProviderIds(
  providers: Provider[],
  count = 5,
): number[] {
  return [...providers]
    .sort(
      (a, b) =>
        a.displayPriority - b.displayPriority || a.name.localeCompare(b.name),
    )
    .slice(0, Math.max(0, count))
    .map((provider) => provider.id);
}

export function toggleProvider(
  settings: Settings,
  providerId: number,
): Settings {
  const selected = new Set(settings.providerIds);
  if (selected.has(providerId)) {
    selected.delete(providerId);
  } else {
    selected.add(providerId);
  }
  return {
    ...settings,
    providerIds: [...selected].sort((a, b) => a - b),
    initialized: true,
  };
}
