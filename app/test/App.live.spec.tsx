import 'react-native';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as React from 'react';

import {App} from '../src/App';
import {
  EmbeddingIndex,
  setEmbeddingIndexForTests,
} from '../src/services/embeddings';
import {setStorageBackend} from '../src/services/storage';
import {createMemoryStorage} from './helpers/memoryStorage';
import {createFakeTmdb, movieSummary} from './helpers/fakeTmdb';

function testIndex(): EmbeddingIndex {
  return {
    dim: 2,
    model: 'test',
    ids: Int32Array.from([10, 12]),
    titles: ['Trending Film', 'Cosy Space Film'],
    years: Int16Array.from([2024, 2023]),
    providerNames: ['Prime Video', 'Netflix'],
    vectorCount: 2,
    vectors: Float32Array.from([0.2, 0.98, 1, 0]),
  };
}

describe('live app flow', () => {
  let storage = createMemoryStorage();

  beforeEach(() => {
    storage = createMemoryStorage();
    setStorageBackend(storage);
    setEmbeddingIndexForTests(null);
  });

  afterEach(() => {
    setStorageBackend(null);
    setEmbeddingIndexForTests(null);
  });

  it('boots into live rows and opens a title with availability', async () => {
    const screen = render(
      <App
        services={{
          tmdb: createFakeTmdb(),
          embed: async () => [Float32Array.from([1, 0])],
          checkEmbed: async () => ({ok: true}),
          configured: true,
        }}
      />,
    );

    expect(await screen.findByText('Trending in India')).toBeTruthy();
    expect(await screen.findByTestId('poster-0-0')).toBeTruthy();
    expect(await screen.findByText('On my services')).toBeTruthy();

    fireEvent.press(screen.getByTestId('poster-0-0'));

    expect(await screen.findByText('WHERE TO WATCH IN INDIA')).toBeTruthy();
    expect((await screen.findAllByText('Prime Video')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Comedy, Drama/)).toBeTruthy();
  });

  it('saves a title to My List and shows it after Back', async () => {
    const screen = render(
      <App
        services={{
          tmdb: createFakeTmdb(),
          embed: async () => [Float32Array.from([1, 0])],
          checkEmbed: async () => ({ok: false}),
          configured: true,
        }}
      />,
    );

    fireEvent.press(await screen.findByTestId('poster-0-0'));
    fireEvent.press(await screen.findByTestId('movie-watchlist'));

    expect(await screen.findByText('✓ In My List')).toBeTruthy();
    fireEvent.press(screen.getByTestId('movie-back'));

    expect(await screen.findByText('My List')).toBeTruthy();
    expect(screen.getByTestId('row-my-list')).toBeTruthy();
    expect(storage.dump().get('ynb:v2:watchlist')).toContain('Trending Film');
  });

  it('changes the on-my-services row when a provider is toggled', async () => {
    const getOnServices = jest.fn(async (_region: string, ids: number[]) => [
      movieSummary({id: 11, title: `On ${ids.join('+') || 'none'}`}),
    ]);

    const screen = render(
      <App
        services={{
          tmdb: createFakeTmdb({getOnServices}),
          embed: async () => [Float32Array.from([1, 0])],
          checkEmbed: async () => ({ok: false}),
          configured: true,
        }}
      />,
    );

    await screen.findByTestId('poster-1-0');
    expect(getOnServices).toHaveBeenLastCalledWith('IN', [1, 2]);

    fireEvent.press(screen.getByTestId('home-settings'));
    fireEvent.press(await screen.findByTestId('provider-2'));
    fireEvent.press(screen.getByTestId('settings-back'));

    await waitFor(() => {
      expect(getOnServices).toHaveBeenLastCalledWith('IN', [1]);
    });
  });

  it('runs semantic search and keeps results when returning from a title', async () => {
    setEmbeddingIndexForTests(testIndex());

    const screen = render(
      <App
        services={{
          tmdb: createFakeTmdb(),
          embed: async () => [Float32Array.from([1, 0])],
          checkEmbed: async () => ({ok: true}),
          configured: true,
        }}
      />,
    );

    fireEvent.press(await screen.findByTestId('home-search'));
    fireEvent.press(await screen.findByTestId('search-suggestion-0'));

    expect(await screen.findByTestId('search-result-0')).toBeTruthy();
    expect(screen.getByText('Cosy Space Film')).toBeTruthy();

    fireEvent.press(screen.getByTestId('search-result-0'));
    expect(await screen.findByText('WHERE TO WATCH IN INDIA')).toBeTruthy();

    fireEvent.press(screen.getByTestId('movie-back'));
    expect(await screen.findByTestId('search-result-0')).toBeTruthy();
  });
});
