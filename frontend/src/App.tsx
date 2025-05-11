import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import OrderManager from './components/OrderManager';
import './App.css';
import Menu from './Menu';

export default function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1><a href="/">TrackFlow</a></h1>
        </header>
        <main className="App-content">
          <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/orders" element={<OrderManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
