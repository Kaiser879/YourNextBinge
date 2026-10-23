import {AvailabilityEntry, Monetization} from '../types.live';

export interface GroupedAvailability {
  stream: AvailabilityEntry[];
  rent: AvailabilityEntry[];
  buy: AvailabilityEntry[];
}

const STREAM_TYPES: Monetization[] = ['flatrate', 'free', 'ads'];

function dedupeAndSort(entries: AvailabilityEntry[]): AvailabilityEntry[] {
  const seen = new Set<number>();
  return entries
    .filter((entry) => {
      if (seen.has(entry.providerId)) {
        return false;
      }
      seen.add(entry.providerId);
      return true;
    })
    .sort((a, b) => a.providerName.localeCompare(b.providerName));
}

/** Group TMDB's five monetization buckets into the three the UI shows. */
export function groupAvailability(
  entries: AvailabilityEntry[],
): GroupedAvailability {
  return {
    stream: dedupeAndSort(
      entries.filter((entry) => STREAM_TYPES.includes(entry.type)),
    ),
    rent: dedupeAndSort(entries.filter((entry) => entry.type === 'rent')),
    buy: dedupeAndSort(entries.filter((entry) => entry.type === 'buy')),
  };
}

/**
 * Best single "where to watch" label. Stream beats rent beats buy; ties are
 * resolved by provider name so the row badge is deterministic.
 */
export function topProvider(entries: AvailabilityEntry[]): string | null {
  const grouped = groupAvailability(entries);
  const first =
    grouped.stream[0] ?? grouped.rent[0] ?? grouped.buy[0] ?? null;
  return first?.providerName ?? null;
}

/** True when the title has any India availability at all. */
export function isAvailable(entries: AvailabilityEntry[]): boolean {
  return entries.length > 0;
}

/** True when the title is on at least one of the user's selected services. */
export function isOnSelectedService(
  entries: AvailabilityEntry[],
  selectedProviderIds: number[],
): boolean {
  if (selectedProviderIds.length === 0) {
    return false;
  }
  const selected = new Set(selectedProviderIds);
  return entries.some((entry) => selected.has(entry.providerId));
}
