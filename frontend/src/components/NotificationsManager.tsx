import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Notifications.css';

interface ProductFormData {
  productName: string;
  productPrice: string;
}

interface PaymentFormData {
  cardFirstName: string;
  cardLastName: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingZipCode: string;
  cardNumber: string;
  securityNumber: string;
  expirationDate: string;
}

interface Order {
  id: number;
  customerName: string;
  email: string;
  status: string;
  address?: string;
  product?: ProductFormData;
  payment?: PaymentFormData;
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
      await axios.put(`${ORDER_API}/${selectedOrder.id}`, {
        ...selectedOrder,
        status: newStatus
      });

      await axios.post(`${ORDER_API}/notify`, {
        orderId: selectedOrder.id,
        email: selectedOrder.email,
        status: newStatus
      });

      setSelectedOrder(null);
      setNewStatus('Received');
      fetchOrders();

      alert('Status updated and notification sent successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status and send notification');
    }
  };

  const maskCardNumber = (cardNumber: string) => {
    if (!cardNumber) return 'N/A';
    const last4 = cardNumber.slice(-4);
    return `xxxx-xxxx-xxxx-${last4}`;
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
          <h4><u>Customer Details</u></h4>
          <p><strong>Name:</strong> {selectedOrder.customerName}</p>
          <p><strong>Email:</strong> {selectedOrder.email}</p>
          <p><strong>Status:</strong> {selectedOrder.status}</p>
          <p><strong>Address:</strong> {selectedOrder.address}</p>

          {selectedOrder.product && (
            <div className="notification-product-details">
              <h4><u>Product Details</u></h4>
              <p><strong>Product Name:</strong> {selectedOrder.product.productName}</p>
              <p><strong>Price:</strong> ${selectedOrder.product.productPrice}</p>
            </div>
          )}

          {selectedOrder.payment && (
            <div className="notification-payment-details">
              <h4><u>Payment Details</u></h4>
              <p><strong>Card Holder:</strong> {selectedOrder.payment.cardFirstName} {selectedOrder.payment.cardLastName}</p>
              <p><strong>Billing Address:</strong> {selectedOrder.payment.billingAddress}</p>
              <p><strong>City/State/Country:</strong> {selectedOrder.payment.billingCity}, {selectedOrder.payment.billingState}, {selectedOrder.payment.billingCountry}</p>
              <p><strong>Zip Code:</strong> {selectedOrder.payment.billingZipCode}</p>
              <p><strong>Card Number:</strong> {maskCardNumber(selectedOrder.payment.cardNumber)}</p>
              <p><strong>Expiration Date:</strong> {selectedOrder.payment.expirationDate}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
