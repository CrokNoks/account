import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { auth, createE2EApp, Mocks } from './e2e-app';
import { ACC } from './ids';
import { ROUTE_ID_PARAM } from '../src/shared/infrastructure/route-id.pipe';

interface Route {
  method: string;
  path: string;
}

/** Toutes les routes déclarées par les contrôleurs, découvertes via Nest (aucune liste à maintenir). */
function discoverRoutes(app: INestApplication): Route[] {
  const routes: Route[] = [];
  const modules = app.get(ModulesContainer);
  for (const module of modules.values()) {
    for (const { metatype } of module.controllers.values()) {
      if (!metatype) continue;
      const base = Reflect.getMetadata(PATH_METADATA, metatype) as string;
      for (const name of Object.getOwnPropertyNames(metatype.prototype)) {
        const handler = (metatype.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const verb = Reflect.getMetadata(METHOD_METADATA, handler) as
          | RequestMethod
          | undefined;
        if (verb === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        routes.push({
          method: RequestMethod[verb].toLowerCase(),
          path: `/${[base, sub].join('/')}`.replace(/\/+/g, '/'),
        });
      }
    }
  }
  return routes;
}

const paramsOf = (path: string) =>
  [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);

/**
 * Routes qui ignorent volontairement le segment `:accountId` de l'URL (jamais lu, aucun accès base :
 * voir docs/reporting.md) : la valeur n'a pas à être un UUID.
 */
const IGNORED_ACCOUNT_SEGMENT = new Set([
  'GET /:accountId/reporting/net-worth',
]);

describe('Route ids are validated as UUIDs on every route (e2e)', () => {
  let app: INestApplication<App>;
  let mocks: Mocks;
  let routes: Route[];

  beforeAll(async () => {
    ({ app, mocks } = await createE2EApp());
    routes = discoverRoutes(app);
  });

  afterAll(() => app.close());

  it('discovers the parametrised routes', () => {
    expect(routes.filter((r) => r.path.includes(':')).length).toBeGreaterThan(
      40,
    );
  });

  it('every route parameter is an id (id or *Id): a new name must be added to the pipe on purpose', () => {
    const names = new Set(routes.flatMap((r) => paramsOf(r.path)));
    expect([...names].filter((n) => !ROUTE_ID_PARAM.test(n))).toEqual([]);
  });

  it('answers 400 for a malformed id, whichever parameter of whichever route, before any repository call', async () => {
    const failures: string[] = [];
    for (const route of routes) {
      if (
        IGNORED_ACCOUNT_SEGMENT.has(
          `${route.method.toUpperCase()} ${route.path}`,
        )
      )
        continue;
      for (const bad of paramsOf(route.path)) {
        jest.clearAllMocks();
        const url = route.path.replace(/:(\w+)/g, (_, name: string) =>
          name === bad ? 'not-a-uuid' : ACC,
        );
        const res = await request(app.getHttpServer())
          [route.method as 'get'](url)
          .set(auth());
        const called = Object.values(mocks).some((repo) =>
          Object.values(repo).some((fn) => fn.mock.calls.length > 0),
        );
        if (res.status !== 400 || called) {
          failures.push(
            `${route.method.toUpperCase()} ${url} -> ${res.status}${called ? ' (repository called)' : ''}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('still serves routes without id and static segments', async () => {
    mocks.preferences.findByUserId.mockResolvedValue(null);
    const http = () => request(app.getHttpServer());
    await http().get('/health').expect(200);
    expect((await http().get('/preferences').set(auth())).status).not.toBe(400);
    for (const path of [
      `/${ACC}/periods/draft-init`,
      `/${ACC}/transactions/predict-category`,
    ]) {
      expect((await http().get(path).set(auth())).status).not.toBe(400);
    }
  });
});
