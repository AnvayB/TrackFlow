import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const boxes = [
    { title: 'Orders', route: '/orders' },
    { title: 'Verification', route: '/verification' },
    { title: 'Box 3' },
    { title: 'Box 4' },
    { title: 'Box 5' },
    { title: 'Box 6' },
    { title: 'Box 7' },
    { title: 'Box 8' },
  ];

  return (
    <div className="dashboard-container">
      {boxes.map((box, index) => (
        <div
          key={index}
          className={`dashboard-box ${box.route ? 'clickable' : ''}`}
          onClick={() => box.route && navigate(box.route)}
        >
          {box.title}
        </div>
      ))}
    </div>
  );
}
