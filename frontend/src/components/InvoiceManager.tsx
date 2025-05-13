/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Invoices.css';

interface Order {
  orderId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  status: string;
  product: string;
  price: number | string;
  shippingCost: number | string;
  tax: number | string;
  totalCost: number | string;
  payment: {
    cardFirstName: string;
    cardLastName: string;
    cardNumberLast4?: string;
    cardNumber?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface InvoiceResponse {
  success: boolean;
  message: string;
  filePath?: string;
  s3Url?: string;
  emailSent?: boolean;
}

const ORDER_API = 'http://localhost:3001/orders';
const INVOICE_API = 'http://localhost:3002/invoices';

export default function InvoiceManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchInput, setSearchInput] = useState({
    orderId: '',
    name: '',
    email: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<number | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(ORDER_API);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Could not load orders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchInput(prev => ({ ...prev, [name]: value }));
  };

  const filteredOrders = orders.filter(order => {
    const matchesId = searchInput.orderId
      ? order.orderId?.toString().includes(searchInput.orderId)
      : true;
    const fullName = `${order.firstName || ''} ${order.lastName || ''}`.toLowerCase();
    const matchesName = searchInput.name
      ? fullName.includes(searchInput.name.toLowerCase())
      : true;
    const matchesEmail = searchInput.email
      ? (order.email || '').toLowerCase().includes(searchInput.email.toLowerCase())
      : true;
    return matchesId && matchesName && matchesEmail;
  });

  const handleGenerateInvoice = async (orderId: number) => {
    try {
      setGeneratingInvoice(orderId);
      setError(null);
      
      const response = await axios.post<InvoiceResponse>(`${INVOICE_API}/generate/${orderId}`);
      
      if (response.data.success) {
        // Handle development mode (local file)
        if (response.data.filePath?.startsWith('local://')) {
          alert('Invoice generated successfully! Check the server console for the file location.');
        }
        // Handle production mode (S3 URL)
        else if (response.data.s3Url) {
          window.open(response.data.s3Url, '_blank');
        }
        
        if (response.data.emailSent) {
          alert('Invoice has been sent to the customer\'s email.');
        }
      } else {
        throw new Error(response.data.message || 'Failed to generate invoice');
      }
    } catch (err) {
      console.error('Invoice generation error:', err);
      const axiosError = err as { response?: { data: { message: string } } };
      setError(axiosError.response?.data?.message || 'Failed to generate invoice. Please try again.');
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const toggleExpand = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const maskCard = (cardNumber?: string) => {
    if (!cardNumber) return 'N/A';
    const last4 = cardNumber.slice(-4);
    return `xxxx-xxxx-xxxx-${last4}`;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? 'N/A' : `$${num.toFixed(2)}`;
  };

  return (
    <div className="invoice-manager">
      <h2>Invoice Manager</h2>
      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-indicator">Loading orders...</div>}

      <div className="search-bar">
        <input 
          name="orderId" 
          placeholder="Order ID" 
          value={searchInput.orderId}
          onChange={handleInputChange} 
        />
        <input 
          name="name" 
          placeholder="Customer Name" 
          value={searchInput.name}
          onChange={handleInputChange} 
        />
        <input 
          name="email" 
          placeholder="Email" 
          value={searchInput.email}
          onChange={handleInputChange} 
        />
      </div>

      <ul className="orders-list">
        {filteredOrders.length === 0 ? (
          <p>No matching orders found.</p>
        ) : (
          filteredOrders.map(order => (
            <li key={order.orderId} className="order-item">
              <div className="order-header">
                <div className="order-summary">
                  <strong>Order #{order.orderId}</strong>
                  <span> — {order.firstName} {order.lastName}</span>
                  <span> — {order.email}</span>
                  <span> — {order.status}</span>
                </div>
                <div className="order-actions">
                  <button 
                    onClick={() => handleGenerateInvoice(order.orderId)} 
                    disabled={generatingInvoice === order.orderId}
                    className="generate-invoice-btn"
                  >
                    {generatingInvoice === order.orderId ? 'Generating...' : 'Generate Invoice'}
                  </button>
                  <button 
                    onClick={() => toggleExpand(order.orderId)}
                    className="toggle-details-btn"
                  >
                    {expandedOrderId === order.orderId ? '▼ Hide Details' : '▶ Show Details'}
                  </button>
                </div>
              </div>

              {expandedOrderId === order.orderId && (
                <div className="order-details">
                  <div className="customer-info">
                    <h4><u>Customer Information</u></h4>
                    <p><strong>Name:</strong> {order.firstName} {order.lastName}</p>
                    <p><strong>Email:</strong> {order.email}</p>
                    <p><strong>Phone:</strong> {order.phoneNumber}</p>
                    <p><strong>Address:</strong> {order.address}, {order.city}, {order.state}, {order.country} {order.zipCode}</p>
                  </div>
                  
                  <div className="order-info">
                    <h4><u>Order Information</u></h4>
                    <p><strong>Product:</strong> {order.product}</p>
                    <p><strong>Price:</strong> {formatCurrency(order.price)}</p>
                    <p><strong>Shipping:</strong> {formatCurrency(order.shippingCost)}</p>
                    <p><strong>Tax:</strong> {formatCurrency(order.tax)}</p>
                    <p><strong>Total:</strong> {formatCurrency(order.totalCost)}</p>
                  </div>
                  
                  <div className="payment-info">
                    <h4><u>Payment Information</u></h4>
                    <p><strong>Card Holder:</strong> {order.payment.cardFirstName} {order.payment.cardLastName}</p>
                    <p><strong>Card Number:</strong> {maskCard(order.payment.cardNumber || order.payment.cardNumberLast4)}</p>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
