/* eslint-disable @typescript-eslint/no-unused-vars */
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Dashboard.css';

export default function Services() {
  const navigate = useNavigate();

  const allBoxes = [
    { title: 'Orders', route: '/orders' },
    { title: 'Verification', route: '/verification' },
    { title: 'Notifications' },
    { title: 'Users' },
    { title: 'Invoices' },
    { title: 'Reporting' },
    { title: 'Health Check' },
    { title: 'Feedback' },
  ];

  const [visibleTitles, setVisibleTitles] = useState(allBoxes.map(b => b.title));
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleModule = (title: string) => {
    setVisibleTitles(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const filteredBoxes = allBoxes.filter(box => visibleTitles.includes(box.title));

  return (
    <>
      <header className="dashboard-header">
        {/* <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        {menuOpen && (
          <div className="module-menu">
            <strong>Customize View</strong>
            {allBoxes.map((box, idx) => (
              <label key={idx}>
                <input
                  type="checkbox"
                  checked={visibleTitles.includes(box.title)}
                  onChange={() => toggleModule(box.title)}
                />
                {box.title}
              </label>
            ))}
          </div>
        )} */}
      </header>

      <div className="dashboard-container">
        {filteredBoxes.map((box, index) => (
          <div
            key={index}
            className={`dashboard-box ${box.route ? 'clickable' : ''}`}
            onClick={() => box.route && navigate(box.route)}
          >
            {box.title}
          </div>
        ))}
      </div>
    </>
  );
}
