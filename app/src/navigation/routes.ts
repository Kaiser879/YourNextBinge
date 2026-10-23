/**
 * Explicit, dependency-free route stack.
 *
 * Trailer playback is an overlay, not a route, so Back closes it before it
 * pops the detail screen.
 */
import {MovieSummary} from '../types.live';

export type Route =
  | {name: 'live-home'}
  | {name: 'search'}
  | {name: 'settings'}
  | {name: 'vibe'}
  | {name: 'refine'}
  | {name: 'results'}
  | {name: 'detail'; titleId: string}
  | {name: 'movie'; movieId: number; seed?: MovieSummary};

export function pushRoute(stack: Route[], route: Route): Route[] {
  return [...stack, route];
}

/** Returns null when popping would empty the stack (caller exits the app). */
export function popRoute(stack: Route[]): Route[] | null {
  if (stack.length <= 1) {
    return null;
  }
  return stack.slice(0, -1);
}

export function replaceRoute(stack: Route[], route: Route): Route[] {
  if (stack.length === 0) {
    return [route];
  }
  return [...stack.slice(0, -1), route];
}

export function initialRoute(configured: boolean): Route {
  return configured ? {name: 'live-home'} : {name: 'vibe'};
}

export function routeKey(route: Route): string {
  switch (route.name) {
    case 'movie':
      return `movie:${route.movieId}`;
    case 'detail':
      return `detail:${route.titleId}`;
    default:
      return route.name;
  }
}
