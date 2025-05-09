import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import OrderManager from './components/OrderManager';
import VerificationManager from './components/VerificationManager';
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1><a href="/">TrackFlow</a></h1>
        </header>
        <main className="App-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrderManager />} />
            <Route path="/verification" element={<VerificationManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
