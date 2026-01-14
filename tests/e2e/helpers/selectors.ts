export const selectors = {
  auth: {
    email: '[data-testid="auth.login.email.input"]',
    password: '[data-testid="auth.login.password.input"]',
    submit: '[data-testid="auth.login.submit.button"]',
    logout: '[data-testid="auth.session.logout.button"]',
  },
  dashboard: {
    summaryCards: '[data-testid="dashboard.summary.cards"]',
    kpiInventory: '[data-testid="dashboard.kpi.inventory.count"]',
    kpiAlerts: '[data-testid="dashboard.kpi.alerts.count"]',
    kpiUpdates: '[data-testid="dashboard.kpi.updates.count"]',
  },
  inventory: {
    table: '[data-testid="inventory.list.table"]',
    filter: '[data-testid="inventory.filter.status.select"]',
    hostname: '[data-testid="inventory.detail.hostname.text"]',
  },
  audit: {
    table: '[data-testid="audit.events.table"]',
    filter: '[data-testid="audit.filter.actor.input"]',
    export: '[data-testid="audit.export.button"]',
  },
  update: {
    policies: '[data-testid="update.policies.table"]',
    dryRun: '[data-testid="update.deploy.dryrun.toggle"]',
    submit: '[data-testid="update.deploy.submit.button"]',
  },
  notifications: {
    emailToggle: '[data-testid="notifications.email.toggle"]',
    smsToggle: '[data-testid="notifications.sms.toggle"]',
    save: '[data-testid="notifications.save.button"]',
  },
} as const;
