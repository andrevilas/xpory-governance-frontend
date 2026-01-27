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
    filter: '[data-testid="inventory.filter.search.input"]',
    hostname: '[data-testid="inventory.detail.hostname.text"]',
  },
  audit: {
    table: '[data-testid="audit.events.table"]',
    filter: '[data-testid="audit.filter.actor.input"]',
    export: '[data-testid="audit.export.button"]',
  },
  auditing: {
    table: '[data-testid="auditing.results.table"]',
    filterStack: '[data-testid="auditing.filter.stack.input"]',
    filterImage: '[data-testid="auditing.filter.image.input"]',
  },
  stacksVariables: {
    search: '[data-testid="stacks.variables.search.input"]',
    instanceSelect: '[data-testid="stacks.variables.instance.select"]',
    variablesTable: '[data-testid="stacks.variables.table"]',
    instanceSearch: '[data-testid="stacks.variables.instance.search.input"]',
    instanceTable: '[data-testid="stacks.variables.instance.table"]',
  },
  redeploy: {
    tabConfirm: '[data-testid="redeploy.tab.confirm"]',
    tabImages: '[data-testid="redeploy.tab.images"]',
    tabVariables: '[data-testid="redeploy.tab.variables"]',
    imagesTable: '[data-testid="redeploy.images.table"]',
    variablesTable: '[data-testid="redeploy.variables.table"]',
    variablesSearch: '[data-testid="redeploy.variables.search.input"]',
  },
  update: {
    policies: '[data-testid="update.policies.table"]',
    dryRun: '[data-testid="update.deploy.dryrun.toggle"]',
    submit: '[data-testid="update.deploy.submit.button"]',
  },
  notifications: {
    configLink: '[data-testid="notifications.config.link"]',
  },
} as const;
