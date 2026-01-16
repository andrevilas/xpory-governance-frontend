import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/auth/useAuth';
import './app-layout.css';

type AppLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function AppLayout({ title, children }: AppLayoutProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/dashboard') ? ' active' : ''}`}
            onClick={() => navigate('/app/dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/instances') ? ' active' : ''}`}
            onClick={() => navigate('/app/instances')}
          >
            Instâncias
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/stacks') ? ' active' : ''}`}
            onClick={() => navigate('/app/stacks')}
          >
            Stacks Globais
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/updates') ? ' active' : ''}`}
            onClick={() => navigate('/app/updates')}
          >
            Atualizações
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/alerts') ? ' active' : ''}`}
            onClick={() => navigate('/app/alerts')}
          >
            Alertas
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/notifications') ? ' active' : ''}`}
            onClick={() => navigate('/app/notifications')}
          >
            Notificacoes
          </button>
        </nav>
      </aside>

      <div className="main">
        <header className="header">
          <div className="breadcrumb">Home / {title}</div>
          <div className="header-actions">
            <button
              type="button"
              className="header-button"
              data-testid="auth.session.logout.button"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </header>

        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
