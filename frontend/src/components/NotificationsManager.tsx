import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Notifications.css';

interface Order {
  id: number;
  customerName: string;
  email: string;
  status: string;
}

const ORDER_API = 'http://localhost:3001/orders';

export default function NotificationsManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>('Received');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await axios.get(ORDER_API);
    setOrders(res.data);
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setNewStatus(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      // Update order status in database
      await axios.put(`${ORDER_API}/${selectedOrder.id}`, {
        ...selectedOrder,
        status: newStatus
      });

      // Send email notification
      await axios.post(`${ORDER_API}/notify`, {
        orderId: selectedOrder.id,
        email: selectedOrder.email,
        status: newStatus
      });

      // Reset form and refresh orders
      setSelectedOrder(null);
      setNewStatus('Received');
      fetchOrders();

      alert('Status updated and notification sent successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status and send notification');
    }
  };

  return (
    <section className='notifications-manager'>
      <h2>Order Status Notifications</h2>
      <form onSubmit={handleSubmit}>
        <select 
          value={selectedOrder?.id || ''} 
          onChange={(e) => {
            const order = orders.find(o => o.id === Number(e.target.value));
            if (order) handleOrderSelect(order);
          }}
          required
        >
          <option value="">Select an order</option>
          {orders.map(order => (
            <option key={order.id} value={order.id}>
              Order #{order.id} - {order.customerName}
            </option>
          ))}
        </select>

        <select 
          value={newStatus} 
          onChange={handleStatusChange}
          required
        >
          <option value="Received">Received</option>
          <option value="Shipped">Shipped</option>
          <option value="Out For Delivery">Out For Delivery</option>
          <option value="Delayed">Delayed</option>
          <option value="Lost">Lost</option>
        </select>

        <button 
          type="submit" 
          disabled={!selectedOrder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.form?.requestSubmit();
            }
          }}
        >
          Send Status Update
        </button>
      </form>

      {selectedOrder && (
        <div className="selected-order-info">
          <h3>Selected Order Details:</h3>
          <p>Customer: {selectedOrder.customerName}</p>
          <p>Email: {selectedOrder.email}</p>
          <p>Current Status: {selectedOrder.status}</p>
        </div>
      )}
    </section>
  );
}
