import { ChangeEvent, useState } from 'react';
import axios from 'axios';
import './Invoices.css';

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
  address: string;
  status: string;
  email?: string;
  product?: ProductFormData;
  payment?: PaymentFormData;
}

const ORDER_API = 'http://localhost:3001/orders';

export default function OrderSearch() {
  const [searchOrderId, setSearchOrderId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

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

  const toggleOrderDetails = (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null); // Collapse if already expanded
    } else {
      setExpandedOrderId(orderId); // Expand this order
    }
  };

  // Mask credit card number for display
  const maskCardNumber = (cardNumber: string) => {
    if (!cardNumber) return 'N/A';
    const last4 = cardNumber.slice(-4);
    return `xxxx-xxxx-xxxx-${last4}`;
  };

  return (
    <section className='invoice-manager'>
      <h2>Generate Invoices</h2>

      <input
        type="number"
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
      <ul className="invoice-order-list">
        {orders.map(order => (
          <li key={order.id} className="invoice-order-item">
            <div className="invoice-order-header">
              <div className="invoice-order-summary" onClick={() => toggleOrderDetails(order.id)}>
                <span style={{ cursor: 'pointer' }}>
                  <strong>ID:</strong> {order.id} — <strong>Name:</strong> {order.customerName} — <strong>Email:</strong> {order.email || 'N/A'}
                </span>
                <span className="expand-icon" style={{ cursor: 'pointer' }}>&nbsp;<b>See Details</b> {expandedOrderId === order.id ? '▼' : '▶'}</span>
              </div>
              <button
                className="export-button"
                onClick={() => {}} // Placeholder for Export functionality
              >
                Export
              </button>
            </div>
            
            {expandedOrderId === order.id && (
              <div className="invoice-order-details">
                <div className="invoice-customer-details">
                  <h4><u>Customer Details</u></h4>
                  <p><strong>Name:</strong> {order.customerName}</p>
                  <p><strong>Email:</strong> {order.email || 'N/A'}</p>
                  <p><strong>Address:</strong> {order.address}</p>
                  <p><strong>Status:</strong> {order.status}</p>
                </div>
                
                {order.product && (
                  <div className="invoice-product-details">
                    <h4><u>Product Details</u></h4>
                    <p><strong>Product Name:</strong> {order.product.productName}</p>
                    <p><strong>Price:</strong> ${order.product.productPrice}</p>
                  </div>
                )}
                
                {order.payment && (
                  <div className="invoice-payment-details">
                    <h4><u>Payment Details</u></h4>
                    <p><strong>Card Holder:</strong> {order.payment.cardFirstName} {order.payment.cardLastName}</p>
                    <p><strong>Billing Address:</strong> {order.payment.billingAddress}</p>
                    <p><strong>City/State/Country:</strong> {order.payment.billingCity}, {order.payment.billingState}, {order.payment.billingCountry}</p>
                    <p><strong>Zip Code:</strong> {order.payment.billingZipCode}</p>
                    <p><strong>Card Number:</strong> {maskCardNumber(order.payment.cardNumber)}</p>
                    <p><strong>Expiration Date:</strong> {order.payment.expirationDate}</p>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}