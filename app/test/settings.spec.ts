import {
  DEFAULT_SETTINGS,
  loadSettings,
  pickDefaultProviderIds,
  saveSettings,
  toggleProvider,
} from '../src/services/settings';
import {setStorageBackend} from '../src/services/storage';
import {Provider} from '../src/types.live';
import {createMemoryStorage} from './helpers/memoryStorage';

const providers: Provider[] = [
  {id: 3, name: 'Zee5', logoPath: null, displayPriority: 30},
  {id: 1, name: 'Prime Video', logoPath: null, displayPriority: 10},
  {id: 2, name: 'Netflix', logoPath: null, displayPriority: 20},
  {id: 4, name: 'SonyLIV', logoPath: null, displayPriority: 40},
  {id: 5, name: 'Apple TV+', logoPath: null, displayPriority: 50},
  {id: 6, name: 'MUBI', logoPath: null, displayPriority: 60},
];

describe('settings', () => {
  let storage = createMemoryStorage();

  beforeEach(() => {
    storage = createMemoryStorage();
    setStorageBackend(storage);
  });

  afterEach(() => {
    setStorageBackend(null);
  });

  it('starts with India and no services', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('picks the most prominent providers on first run', () => {
    expect(pickDefaultProviderIds(providers, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('toggles a provider and marks settings initialized', () => {
    const next = toggleProvider(DEFAULT_SETTINGS, 2);
    expect(next.providerIds).toEqual([2]);
    expect(next.initialized).toBe(true);
    expect(toggleProvider(next, 2).providerIds).toEqual([]);
  });

  it('persists and restores', async () => {
    const saved = {...DEFAULT_SETTINGS, providerIds: [1, 2], initialized: true};
    await saveSettings(saved);
    expect(await loadSettings()).toEqual(saved);
  });

  it('ignores malformed storage', async () => {
    storage.dump().set('ynb:v2:settings', JSON.stringify({version: 99}));
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
