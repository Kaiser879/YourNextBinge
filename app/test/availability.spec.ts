import {
  groupAvailability,
  isAvailable,
  isOnSelectedService,
  topProvider,
} from '../src/services/availability';
import {AvailabilityEntry} from '../src/types.live';

const entries: AvailabilityEntry[] = [
  {providerId: 1, providerName: 'Zeta', type: 'buy'},
  {providerId: 2, providerName: 'Prime Video', type: 'flatrate'},
  {providerId: 3, providerName: 'JioHotstar', type: 'ads'},
  {providerId: 4, providerName: 'Apple TV', type: 'rent'},
  {providerId: 2, providerName: 'Prime Video', type: 'rent'},
  {providerId: 5, providerName: 'YouTube', type: 'free'},
];

describe('availability', () => {
  it('groups stream, rent, and buy buckets', () => {
    const grouped = groupAvailability(entries);
    expect(grouped.stream.map((entry) => entry.providerName)).toEqual([
      'JioHotstar',
      'Prime Video',
      'YouTube',
    ]);
    expect(grouped.rent.map((entry) => entry.providerName)).toEqual([
      'Apple TV',
      'Prime Video',
    ]);
    expect(grouped.buy.map((entry) => entry.providerName)).toEqual(['Zeta']);
  });

  it('dedupes providers within a group', () => {
    const grouped = groupAvailability([
      {providerId: 9, providerName: 'Netflix', type: 'flatrate'},
      {providerId: 9, providerName: 'Netflix', type: 'ads'},
    ]);
    expect(grouped.stream).toHaveLength(1);
  });

  it('prefers stream, then rent, then buy for the row badge', () => {
    expect(topProvider(entries)).toBe('JioHotstar');
    expect(topProvider([{providerId: 1, providerName: 'Store', type: 'buy'}])).toBe(
      'Store',
    );
    expect(topProvider([])).toBeNull();
  });

  it('answers availability questions', () => {
    expect(isAvailable(entries)).toBe(true);
    expect(isAvailable([])).toBe(false);
    expect(isOnSelectedService(entries, [2])).toBe(true);
    expect(isOnSelectedService(entries, [99])).toBe(false);
    expect(isOnSelectedService(entries, [])).toBe(false);
  });
});
