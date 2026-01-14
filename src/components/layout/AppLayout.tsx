import './app-layout.css';

type AppLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function AppLayout({ title, children }: AppLayoutProps): JSX.Element {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">XP</span>
          <div>
            <div className="brand-title">XPORY</div>
            <div className="brand-subtitle">Governance</div>
          </div>
        </div>

        <nav className="nav">
          <button type="button" className="nav-item active">Dashboard</button>
          <button type="button" className="nav-item">Stacks</button>
          <button type="button" className="nav-item">Auditoria</button>
          <button type="button" className="nav-item">Atualizacoes</button>
          <button type="button" className="nav-item">Alertas</button>
        </nav>
      </aside>

      <div className="main">
        <header className="header">
          <div className="breadcrumb">Home / {title}</div>
          <div className="header-actions">
            <button type="button" className="header-button">Conta</button>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
