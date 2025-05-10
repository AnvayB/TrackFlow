import { JSX, useState } from 'react';
import './Dashboard.css';
import OrderManager from './components/OrderManager';
import VerificationManager from './components/VerificationManager';
import Services from './Services';
// import ReportingManager from './ReportingManager';
// import NotificationManager from './NotificationManager';

interface Tab {
  title: string;
  component: JSX.Element;
}

export default function Dashboard() {
  const tabs: Tab[] = [
    { title: 'Services', component: <Services /> },
    { title: 'Orders', component: <OrderManager /> },
    { title: 'Verification', component: <VerificationManager /> },
    // { title: 'Reporting', component: <ReportingManager /> },
    // { title: 'Notifications', component: <NotificationManager /> },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].title);

  const getActiveComponent = () => {
    const active = tabs.find(tab => tab.title === activeTab);
    return active ? active.component : null;
  };

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-tabs">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`dashboard-tab ${activeTab === tab.title ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.title)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div className="dashboard-content">
        {getActiveComponent()}
      </div>
    </div>
  );
}

