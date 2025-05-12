import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './micro.css';

interface Order {
  id: number;
  customerName: string;
  email: string;
  address: string;
  status: string;
}

const ORDER_API = 'http://localhost:3001/orders';

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<Omit<Order, 'id'>>({ customerName: '', email: '', address: '', status: 'Pending' });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await axios.get(ORDER_API);
    setOrders(res.data);
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
    setForm({ customerName: '', email: '', address: '', status: 'Pending' });
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

  return (
    <section>
      <h2>Order Management</h2>
      <form onSubmit={handleSubmit}>
        <input name="customerName" value={form.customerName} onChange={handleChange} placeholder="Customer Name" required />
        <input name="email" value={form.email} onChange={handleChange} placeholder="Email" required />
        <input name="address" value={form.address} onChange={handleChange} placeholder="Address" required />
        <select name="status" value={form.status} onChange={handleChange}>
          <option>Pending</option>
          <option>Processed</option>
          <option>Out for Delivery</option>
          <option>Delivered</option>
        </select>
        <button type="submit"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.form?.requestSubmit(); // Programmatically submits the form
          }
        }}
        >{editingId ? 'Update' : 'Add'} Order</button>
      </form>
      <ul>
        {orders.map(order => (
          <li key={order.id}>
             <strong>ID #{order.id}: {order.customerName}</strong>  <br />- {order.email} <br />- {order.address} <br />[{order.status}]
            <button onClick={() => handleEdit(order)}>Edit</button>
            <button onClick={() => handleDelete(order.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
