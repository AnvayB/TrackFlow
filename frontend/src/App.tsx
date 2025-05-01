import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3001/orders';

type Order = {
  id: number;
  customerName: string;
  address: string;
  status: string;
};

type OrderForm = Omit<Order, 'id'>;

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<OrderForm>({ customerName: '', address: '', status: 'Pending' });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await axios.get<Order[]>(API_URL);
    setOrders(res.data);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prevForm => ({ ...prevForm, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingId !== null) {
      await axios.put(`${API_URL}/${editingId}`, form);
      setEditingId(null);
    } else {
      await axios.post(API_URL, form);
    }
    setForm({ customerName: '', address: '', status: 'Pending' });
    fetchOrders();
  };

  const handleEdit = (order: Order) => {
    const { customerName, address, status } = order;
    setForm({ customerName, address, status });
    setEditingId(order.id);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${API_URL}/${id}`);
    fetchOrders();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Order Management</h2>
      <form onSubmit={handleSubmit}>
        <input
          name="customerName"
          value={form.customerName}
          onChange={handleChange}
          placeholder="Customer Name"
          required
        />
        <input
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="Address"
          required
        />
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
    </div>
  );
}
