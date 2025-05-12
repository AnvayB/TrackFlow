import { ChangeEvent, useState } from 'react';
import axios from 'axios';

interface Order {
  id: number;
  customerName: string;
  address: string;
  status: string;
  email?: string;
}

const ORDER_API = 'http://localhost:3001/orders';

export default function OrderSearch() {
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    try {
      const res = await axios.get(ORDER_API);
      const filtered = res.data.filter((order: Order) => {
        const matchesId = searchOrderId
          ? order.id.toString().includes(searchOrderId)
          : true;
        const matchesName = searchName
          ? order.customerName.toLowerCase().includes(searchName.toLowerCase())
          : true;
        const matchesEmail = searchEmail
          ? order.email?.toLowerCase().includes(searchEmail.toLowerCase())
          : true;
        return matchesId && matchesName && matchesEmail;
      });
      setOrders(filtered);
      setHasSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
      setOrders([]);
      setHasSearched(true);
    }
  };

  return (
    <section>
      <h2>Search Orders</h2>

      <input
        type="text"
        placeholder="Order ID"
        value={searchOrderId}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchOrderId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Customer name"
        value={searchName}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Email"
        value={searchEmail}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchEmail(e.target.value)}
      />

      <button onClick={handleSearch}>Search</button>

      {hasSearched && orders.length === 0 && <p>No matching orders found.</p>}

      <ul>
        {orders.map(order => (
          <li key={order.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>
                <strong>ID:</strong> {order.id} — <strong>Name:</strong> {order.customerName} — <strong>Email:</strong> {order.email || 'N/A'}
            </span>
            <button
              style={{
                backgroundColor: 'red',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '4px'
              }}
              onClick={() => {}} // Placeholder for Export functionality
            >
              Export
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
