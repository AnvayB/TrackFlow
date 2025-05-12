import { JSX, useState } from 'react';
import OrderManager from './components/OrderManager';
import InvoiceManager from './components/InvoiceManager';
import NotificationsManager from './components/NotificationsManager';
interface Tab {
  title: string;
  component: JSX.Element;
}

export default function Dashboard() {
  const tabs: Tab[] = [
    { title: 'Orders', component: <OrderManager /> },
    { title: 'Invoices', component: <InvoiceManager /> },
    { title: 'Notifications', component: <NotificationsManager /> },
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

