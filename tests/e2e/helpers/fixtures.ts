export const fixtures = {
  auth: {
    email: 'admin@xpory.local',
    password: 'Xpory#123',
    token: 'test-token',
  },
  inventory: {
    summary: {
      stacks: 2,
      endpoints: 1,
      outdatedStacks: 1,
      lastAuditAt: '2024-01-10T12:00:00Z',
    },
    stacks: [
      {
        id: 'stack-1',
        portainerStackId: 101,
        endpointId: 1,
        name: 'xpory-api',
        status: 1,
        type: 1,
        lastSnapshotAt: null,
        outdated: true,
      },
      {
        id: 'stack-2',
        portainerStackId: 102,
        endpointId: 1,
        name: 'xpory-front',
        status: 1,
        type: 1,
        lastSnapshotAt: null,
        outdated: false,
      },
    ],
  },
  portainer: {
    endpoints: [
      {
        id: 1,
        name: 'primary',
      },
    ],
  },
  audit: {
    resultsByStack: {
      'stack-1': [
        {
          id: 'audit-1',
          stackUuid: 'stack-1',
          image: 'xpory/api',
          currentTag: '1.0.0',
          latestTag: '1.1.0',
          updateAvailable: true,
          createdAt: '2024-01-10T12:30:00Z',
        },
        {
          id: 'audit-2',
          stackUuid: 'stack-1',
          image: 'xpory/worker',
          currentTag: '2.0.0',
          latestTag: '2.0.0',
          updateAvailable: false,
          createdAt: '2024-01-10T12:30:00Z',
        },
      ],
      'stack-2': [],
    },
  },
  notifications: {
    logs: [
      {
        id: 'log-1',
        channel: 'email',
        recipient: 'ops@xpory.com',
        subject: 'Stack xpory-api',
        message: 'Notificacao enviada.',
        status: 'sent',
        providerResponse: null,
        createdAt: '2024-01-10T09:00:00Z',
      },
      {
        id: 'log-2',
        channel: 'sms',
        recipient: '+5511999999999',
        subject: 'Stack xpory-front',
        message: 'Falha no envio.',
        status: 'failed',
        providerResponse: null,
        createdAt: '2024-01-10T09:30:00Z',
      },
      {
        id: 'log-3',
        channel: 'sms',
        recipient: '+5511888888888',
        subject: 'Stack xpory-api',
        message: 'Mensagem em fila.',
        status: 'queued',
        providerResponse: null,
        createdAt: '2024-01-10T10:00:00Z',
      },
    ],
  },
  update: {
    compose: 'version: "3"\nservices:\n  api:\n    image: xpory/api:1.0.0\n',
    steps: {
      preHealth: true,
      postHealth: true,
    },
  },
} as const;
