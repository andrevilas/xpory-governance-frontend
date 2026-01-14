import { Page } from '@playwright/test';

import { fixtures } from './fixtures';

type LoginPayload = {
  email?: string;
  password?: string;
};

function jsonResponse(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

export async function setupApiMocks(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/auth/login' && method === 'POST') {
      const payload = (request.postDataJSON() ?? {}) as LoginPayload;
      if (payload.email === fixtures.auth.email && payload.password === fixtures.auth.password) {
        return route.fulfill(
          jsonResponse({
            accessToken: fixtures.auth.token,
            expiresIn: 3600,
          })
        );
      }
      return route.fulfill(jsonResponse({ message: 'invalid credentials' }, 401));
    }

    if (path === '/api/inventory/summary' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.inventory.summary));
    }

    if (path === '/api/inventory/stacks' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.inventory.stacks));
    }

    if (path === '/api/portainer/endpoints' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.portainer.endpoints));
    }

    if (path.startsWith('/api/audit/stacks/') && method === 'GET') {
      const stackId = path.split('/').pop() ?? '';
      const results = fixtures.audit.resultsByStack[stackId] ?? [];
      return route.fulfill(jsonResponse(results));
    }

    if (path === '/api/notifications/logs' && method === 'GET') {
      const status = url.searchParams.get('status');
      const channel = url.searchParams.get('channel');
      const filtered = fixtures.notifications.logs.filter((log) => {
        if (status && log.status !== status) {
          return false;
        }
        if (channel && log.channel !== channel) {
          return false;
        }
        return true;
      });
      return route.fulfill(jsonResponse(filtered));
    }

    if (path.startsWith('/api/portainer/stacks/') && path.endsWith('/compose') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: fixtures.update.compose,
      });
    }

    if (path.startsWith('/api/stacks/') && path.endsWith('/update') && method === 'POST') {
      const stackId = Number(path.split('/')[3] ?? 0);
      const payload = (request.postDataJSON() ?? {}) as { dryRun?: boolean; endpointId?: number };
      return route.fulfill(
        jsonResponse({
          stackId,
          endpointId: payload.endpointId ?? fixtures.inventory.stacks[0].endpointId,
          dryRun: payload.dryRun ?? false,
          steps: fixtures.update.steps,
          errors: [],
          rollbackApplied: false,
        })
      );
    }

    return route.fulfill(jsonResponse({ message: 'not mocked' }, 404));
  });
}
