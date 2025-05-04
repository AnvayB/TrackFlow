import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';


interface Order {
  id: number;
  customerName: string;
  address: string;
  status: string;
}

interface Verification {
  orderId: string;
  gpsLat: string;
  gpsLong: string;
  photo?: string;
  timestamp?: string;
}

const ORDER_API = 'http://localhost:3001/orders';
const VERIFY_API = 'http://localhost:3002/verify';
const VERIFY_LIST_API = 'http://localhost:3002/verifications';

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<Omit<Order, 'id'>>({ customerName: '', address: '', status: 'Pending' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const [verification, setVerification] = useState<Verification>({ orderId: '', gpsLat: '', gpsLong: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchVerifications();
  }, []);

  const fetchOrders = async () => {
    const res = await axios.get(ORDER_API);
    setOrders(res.data);
  };

  const fetchVerifications = async () => {
    const res = await axios.get(VERIFY_LIST_API);
    setVerifications(res.data);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingId) {
      await axios.put(`${ORDER_API}/${editingId}`, form);
      setEditingId(null);
    } else {
      await axios.post(ORDER_API, form);
    }
    setForm({ customerName: '', address: '', status: 'Pending' });
    fetchOrders();
  };

  const handleEdit = (order: Order) => {
    setForm(order);
    setEditingId(order.id);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${ORDER_API}/${id}`);
    fetchOrders();
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.append('orderId', verification.orderId);
    data.append('gpsLat', verification.gpsLat);
    data.append('gpsLong', verification.gpsLong);
    if (photo) data.append('photo', photo);
    await axios.post(VERIFY_API, data);
    setVerification({ orderId: '', gpsLat: '', gpsLong: '' });
    setPhoto(null);
    fetchVerifications();
  };

  return (   
    <div>
      <header className="App-header">
        <h1>TrackFlow</h1>
      </header>
     <main className="App-content" style={{ padding: '2rem' }}>
      <h2>Order Management</h2>
      <form onSubmit={handleSubmit}>
        <input name="customerName" value={form.customerName} onChange={handleChange} placeholder="Customer Name" required />
        <input name="address" value={form.address} onChange={handleChange} placeholder="Address" required />
        <select name="status" value={form.status} onChange={handleChange}>
          <option>Pending</option>
          <option>Processed</option>
          <option>Out for Delivery</option>
          <option>Delivered</option>
        </select>
        <button type="submit">{editingId ? 'Update' : 'Add'} Order</button>
      </form>
      <ul>
        {orders.map(order => (
          <li key={order.id}>
            <strong>{order.customerName}</strong> - {order.address} [{order.status}]
            <button onClick={() => handleEdit(order)}>Edit</button>
            <button onClick={() => handleDelete(order.id)}>Delete</button>
          </li>
        ))}
      </ul>

      <h2>Delivery Verification</h2>
      <form onSubmit={handleVerify}>
        <input name="orderId" value={verification.orderId} onChange={(e) => setVerification({ ...verification, orderId: e.target.value })} placeholder="Order ID" required />
        <input name="gpsLat" value={verification.gpsLat} onChange={(e) => setVerification({ ...verification, gpsLat: e.target.value })} placeholder="GPS Latitude" required />
        <input name="gpsLong" value={verification.gpsLong} onChange={(e) => setVerification({ ...verification, gpsLong: e.target.value })} placeholder="GPS Longitude" required />
        <input type="file" onChange={(e) => setPhoto(e.target.files ? e.target.files[0] : null)} />
        <button type="submit">Submit Verification</button>
      </form>
      <ul>
        {verifications.map((v, i) => (
          <li key={i}>
            Order #{v.orderId} – Lat: {v.gpsLat}, Long: {v.gpsLong}, Time: {v.timestamp ? new Date(v.timestamp).toLocaleString() : 'N/A'} {v.photo && `(Photo: ${v.photo})`}
          </li>
        ))}
      </ul>
    </main>
    </div>
  );
}