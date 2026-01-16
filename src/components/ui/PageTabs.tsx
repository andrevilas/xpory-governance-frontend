import { useLocation, useNavigate } from 'react-router-dom';

import './page-tabs.css';

type PageTab = {
  label: string;
  path: string;
};

type PageTabsProps = {
  tabs: PageTab[];
};

export function PageTabs({ tabs }: PageTabsProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="page-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          type="button"
          className={location.pathname === tab.path ? 'active' : ''}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
