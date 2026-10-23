import {
  initialRoute,
  popRoute,
  pushRoute,
  replaceRoute,
  Route,
} from '../src/navigation/routes';

describe('route stack', () => {
  it('starts on live home or the offline vibe flow', () => {
    expect(initialRoute(true)).toEqual({name: 'live-home'});
    expect(initialRoute(false)).toEqual({name: 'vibe'});
  });

  it('pushes and pops without losing the root', () => {
    const home: Route = {name: 'live-home'};
    const search: Route = {name: 'search'};
    const movie: Route = {name: 'movie', movieId: 42};

    const stack = pushRoute(pushRoute([home], search), movie);
    expect(stack.map((route) => route.name)).toEqual([
      'live-home',
      'search',
      'movie',
    ]);
    expect(popRoute(stack)?.map((route) => route.name)).toEqual([
      'live-home',
      'search',
    ]);
  });

  it('refuses to pop the root', () => {
    expect(popRoute([{name: 'live-home'}])).toBeNull();
    expect(popRoute([])).toBeNull();
  });

  it('replaces the top route', () => {
    const stack = replaceRoute(
      [{name: 'vibe'}, {name: 'refine'}],
      {name: 'results'},
    );
    expect(stack.map((route) => route.name)).toEqual(['vibe', 'results']);
    expect(replaceRoute([], {name: 'vibe'})).toHaveLength(1);
  });
});
