import 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import * as React from 'react';

import {App} from '../src/App';

describe('Your Next Binge app flow', () => {
  it('opens on the mood selection screen when live data is unavailable', async () => {
    const screen = render(<App />);

    expect(
      await screen.findByText('What are you in the mood for?'),
    ).toBeTruthy();
    expect(screen.getByTestId('mood-cozy')).toBeTruthy();
    expect(screen.getByTestId('mood-thought-provoking')).toBeTruthy();
  });

  it('moves from mood selection to refinement', async () => {
    const screen = render(<App />);
    await screen.findByTestId('mood-cozy');

    fireEvent.press(screen.getByTestId('mood-cozy'));
    fireEvent.press(screen.getByTestId('mood-continue'));

    expect(screen.getByText('Anything else we should know?')).toBeTruthy();
    expect(screen.getByTestId('refine-submit')).toBeTruthy();
  });

  it('shows ranked results after submitting filters', async () => {
    const screen = render(<App />);
    await screen.findByTestId('mood-funny');

    fireEvent.press(screen.getByTestId('mood-funny'));
    fireEvent.press(screen.getByTestId('mood-continue'));
    fireEvent.press(screen.getByTestId('runtime-90'));
    fireEvent.press(screen.getByTestId('refine-submit'));

    expect(screen.getByText('These fit what you asked for.')).toBeTruthy();
    expect(screen.getByTestId('result-0')).toBeTruthy();
  });

  it('opens title details and returns to the same results', async () => {
    const screen = render(<App />);
    await screen.findByTestId('mood-cozy');

    fireEvent.press(screen.getByTestId('mood-cozy'));
    fireEvent.press(screen.getByTestId('mood-continue'));
    fireEvent.press(screen.getByTestId('refine-submit'));
    fireEvent.press(screen.getByTestId('result-0'));

    expect(screen.getByText('WHY THIS FITS')).toBeTruthy();

    fireEvent.press(screen.getByTestId('detail-back'));

    expect(screen.getByText('These fit what you asked for.')).toBeTruthy();
  });

  it('relaxes filters rather than showing an empty screen', async () => {
    const screen = render(<App />);
    await screen.findByTestId('mood-romantic');

    fireEvent.press(screen.getByTestId('mood-romantic'));
    fireEvent.press(screen.getByTestId('mood-continue'));
    fireEvent.press(screen.getByTestId('genre-mystery'));
    fireEvent.press(screen.getByTestId('era-earlier'));
    fireEvent.press(screen.getByTestId('runtime-90'));
    fireEvent.press(screen.getByTestId('refine-submit'));

    expect(
      screen.getByText('Nothing matched exactly, so we widened the search.'),
    ).toBeTruthy();
    expect(screen.getByTestId('results-broaden')).toBeTruthy();
  });
});
