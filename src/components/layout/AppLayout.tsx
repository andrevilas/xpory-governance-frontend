import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/auth/useAuth';
import { ActionNotificationsPanel } from '../actions/ActionNotificationsPanel';
import './app-layout.css';

type AppLayoutProps = {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
};

export function AppLayout({ title, children, headerAction }: AppLayoutProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isMaster } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="app-layout">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark">XP</span>
            <div>
              <div className="brand-title">XPORY</div>
              <div className="brand-subtitle">Governance</div>
            </div>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            Menu
          </button>
        </div>

        <nav className="nav" id="app-navigation">
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/dashboard') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/history') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/history')}
          >
            Histórico
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/instances') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/instances')}
          >
            Instâncias
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/stacks-monitored') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/stacks-monitored')}
          >
            Stacks monitoradas
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.startsWith('/app/stacks') && !location.pathname.startsWith('/app/stacks-monitored') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/stacks')}
          >
            Stacks Globais
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/auditing') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/auditing')}
          >
            Auditorias
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/updates') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/updates')}
          >
            Atualizações
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/alerts') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/alerts')}
          >
            Alertas
          </button>
          <button
            type="button"
            className={`nav-item${location.pathname.includes('/app/notifications') ? ' active' : ''}`}
            onClick={() => handleNavigate('/app/notifications/recipients')}
          >
            Notificações
          </button>
          {isMaster && (
            <button
              type="button"
              className={`nav-item${location.pathname.includes('/app/users') ? ' active' : ''}`}
              onClick={() => handleNavigate('/app/users')}
            >
              Usuários
            </button>
          )}
        </nav>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="menu-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="main">
        <header className="header">
          <div className="breadcrumb">Home / {title}</div>
          <div className="header-actions">
            {headerAction}
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

      <ActionNotificationsPanel />
    </div>
  );
}
