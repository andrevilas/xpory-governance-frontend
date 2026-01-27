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
  const stackLocalVariablesState = structuredClone(fixtures.stackLocalVariables);
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

    if (path === '/api/inventory/runs' && method === 'GET') {
      return route.fulfill(jsonResponse([]));
    }

    if (path === '/api/audit/runs' && method === 'GET') {
      return route.fulfill(jsonResponse([]));
    }

    if (path === '/api/audit/summary' && method === 'GET') {
      return route.fulfill(jsonResponse({ failedRuns: 0, failedResults: 0 }));
    }

    if (path === '/api/audit/results' && method === 'GET') {
      const stackName = url.searchParams.get('stackName');
      const instanceName = url.searchParams.get('instanceName');
      const riskLevel = url.searchParams.get('riskLevel');
      const filtered = fixtures.audit.resultsAll.filter((item) => {
        if (stackName && item.stackName !== stackName) {
          return false;
        }
        if (instanceName && item.instanceName !== instanceName) {
          return false;
        }
        if (riskLevel && item.riskLevel !== riskLevel) {
          return false;
        }
        return true;
      });
      return route.fulfill(jsonResponse(filtered));
    }

    if (path === '/api/portainer/endpoints' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.portainer.endpoints));
    }

    if (path === '/api/instances' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.instances));
    }

    if (path === '/api/stacks/local' && method === 'GET') {
      return route.fulfill(jsonResponse(fixtures.stacksLocal));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/variables$/) && method === 'GET') {
      const stackId = path.split('/')[4] ?? '';
      return route.fulfill(jsonResponse(stackLocalVariablesState[stackId] ?? []));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/versions$/) && method === 'GET') {
      const stackId = path.split('/')[4] ?? '';
      return route.fulfill(jsonResponse(fixtures.stackLocalVersions?.[stackId] ?? []));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/variables\/[^/]+$/) && method === 'DELETE') {
      const [, , , , stackId, , variableId] = path.split('/');
      const current = stackLocalVariablesState[stackId] ?? [];
      stackLocalVariablesState[stackId] = current.filter((variable) => variable.id !== variableId);
      return route.fulfill(jsonResponse({ status: 'ok' }));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/variables$/) && method === 'DELETE') {
      const stackId = path.split('/')[4] ?? '';
      const payload = (request.postDataJSON() ?? {}) as { ids?: string[] };
      const ids = payload.ids ?? [];
      const current = stackLocalVariablesState[stackId] ?? [];
      stackLocalVariablesState[stackId] = current.filter((variable) => !ids.includes(variable.id));
      return route.fulfill(jsonResponse({ status: 'ok', deleted: ids.length }));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/instances\/[^/]+\/variables$/) && method === 'GET') {
      const [, , , , stackId, , instanceId] = path.split('/');
      const values = fixtures.stackInstanceVariables[stackId]?.[instanceId] ?? [];
      return route.fulfill(jsonResponse(values));
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/instances\/[^/]+\/variables\/.+$/) && method === 'PUT') {
      const [, , , , stackId, , instanceId, , variableName] = path.split('/');
      const payload = (request.postDataJSON() ?? {}) as { value?: string };
      return route.fulfill(
        jsonResponse({
          stackId,
          instanceId,
          variableName,
          value: payload.value ?? '',
          createdAt: '2024-01-10T10:10:00Z',
          updatedAt: '2024-01-10T10:10:00Z',
        })
      );
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/preview\/[^/]+$/) && method === 'GET') {
      const [, , , , stackId, , instanceId] = path.split('/');
      return route.fulfill(
        jsonResponse({
          stackId,
          instanceId,
          resolvedTemplate: '',
          missingVariables: [],
          unknownVariables: [],
          isValid: true,
        })
      );
    }

    if (path.match(/^\/api\/stacks\/local\/[^/]+\/redeploy$/) && method === 'POST') {
      return route.fulfill(
        jsonResponse([
          {
            instanceId: 'instance-1',
            portainerStackId: 101,
            endpointId: 1,
            status: 'success',
            message: 'ok',
            errors: [],
            rollbackApplied: false,
          },
        ])
      );
    }

    if (path.startsWith('/api/audit/stacks/') && method === 'GET') {
      const stackId = path.split('/').pop() ?? '';
      const results = fixtures.audit.resultsByStack[stackId] ?? [];
      return route.fulfill(jsonResponse(results));
    }

    if (path.match(/^\/api\/registry\/stacks\/[^/]+\/images$/) && method === 'GET') {
      const stackId = path.split('/')[4] ?? '';
      return route.fulfill(jsonResponse(fixtures.registry.imagesByStack[stackId] ?? []));
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

    if (path === '/api/update/validate' && method === 'POST') {
      return route.fulfill(jsonResponse({ valid: true, errors: [] }));
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
