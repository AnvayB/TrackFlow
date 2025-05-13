/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Orders.css';

interface Order {
  id?: number;
  orderId?: string;
  customerName?: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phoneNumber: string;
  status: string;
  product: string;
  price: number | string;
  shippingCost: number | string;
  payment: {
    cardFirstName: string;
    cardLastName: string;
    billingAddress: string;
    billingCity: string;
    billingState: string;
    billingCountry: string;
    billingZipCode: string;
    cardNumber: string;
    securityNumber: string;
    expDate: string;
  };
  totalCost?: string;
  tax?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Add error response type
interface ErrorResponse {
  error?: string;
  errors?: Array<{ msg: string }>;
  status?: number;
}

const ORDER_API = 'http://localhost:3001/orders';

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<Order>({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    phoneNumber: '',
    status: 'received',
    product: '',
    price: '',
    shippingCost: '',
    payment: {
      cardFirstName: '',
      cardLastName: '',
      billingAddress: '',
      billingCity: '',
      billingState: '',
      billingCountry: '',
      billingZipCode: '',
      cardNumber: '',
      securityNumber: '',
      expDate: ''
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Add missing state variables
  const [productFormData, setProductFormData] = useState<{ productName: string; productPrice: string }>({
    productName: '',
    productPrice: ''
  });
  const [paymentFormData, setPaymentFormData] = useState<Order['payment']>({
    cardFirstName: '',
    cardLastName: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingCountry: '',
    billingZipCode: '',
    cardNumber: '',
    securityNumber: '',
    expDate: ''
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(ORDER_API);
      console.log('Fetched orders:', res.data);
      setOrders(res.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setError('Failed to fetch orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle nested payment fields
    if (name.startsWith('payment.')) {
      const paymentField = name.split('.')[1];
      setForm({
        ...form,
        payment: {
          ...form.payment,
          [paymentField]: value
        }
      });
    } else {
      setForm({
        ...form,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Merge form sections into one payload
    const fullOrder = {
      ...form,
      product: form.product,
      payment: form.payment,
    };

    try {
      console.log('Submitting order:', JSON.stringify(fullOrder, null, 2));

      if (editingId) {
        const response = await axios.put(`${ORDER_API}/${editingId}`, fullOrder);
        console.log('Order updated:', response.data);
        setEditingId(null);
      } else {
        const response = await axios.post(ORDER_API, fullOrder);
        console.log('Order created:', response.data);
      }

      // Reset form with proper type
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        phoneNumber: '',
        status: 'received',
        product: '',
        price: '',
        shippingCost: '',
        payment: {
          cardFirstName: '',
          cardLastName: '',
          billingAddress: '',
          billingCity: '',
          billingState: '',
          billingCountry: '',
          billingZipCode: '',
          cardNumber: '',
          securityNumber: '',
          expDate: ''
        }
      });

      fetchOrders();
    } catch (error: unknown) {
      console.error('Error submitting order:', error);
      const axiosError = error as { response?: { data: ErrorResponse; status: number } };

      if (axiosError.response) {
        console.error('Error response data:', axiosError.response.data);
        console.error('Error response status:', axiosError.response.status);

        if (axiosError.response.data?.errors) {
          const errorMessages = axiosError.response.data.errors.map(err => err.msg).join(', ');
          setError(`Failed to submit order: ${errorMessages}`);
        } else {
          setError(`Failed to submit order: ${axiosError.response.data?.error || 'Unknown error'}`);
        }
      } else {
        setError(`Failed to submit order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order: Order) => {
    console.log('Editing order:', order);
    
    // Ensure the form has all required fields from the order
    setForm({
      firstName: order.firstName || '',
      lastName: order.lastName || '',
      email: order.email || '',
      phoneNumber: order.phoneNumber || '',
      address: order.address || '',
      city: order.city || '',
      state: order.state || '',
      country: order.country || '',
      zipCode: order.zipCode || '',
      product: order.product || '',
      price: order.price || '',
      shippingCost: order.shippingCost || '',
      status: order.status || 'received',
      payment: {
        cardFirstName: order.payment?.cardFirstName || '',
        cardLastName: order.payment?.cardLastName || '',
        billingAddress: order.payment?.billingAddress || '',
        billingCity: order.payment?.billingCity || '',
        billingState: order.payment?.billingState || '',
        billingCountry: order.payment?.billingCountry || '',
        billingZipCode: order.payment?.billingZipCode || '',
        cardNumber: '', // Don't pre-fill card number for security
        securityNumber: '', // Don't pre-fill security number for security
        expDate: order.payment?.expDate || ''
      }
    });
    
    setEditingId(order.orderId || null);
  };

  const handleDelete = async (orderId: string) => {
    try {
      setLoading(true);
      console.log('Deleting order:', orderId);
      await axios.delete(`${ORDER_API}/${orderId}`);
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      setError('Failed to delete order.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (orderId: string) => {
    try {
      setLoading(true);
      console.log('Generating invoice for order:', orderId);
      const response = await axios.post(`${ORDER_API}/${orderId}/invoice`);
      console.log('Invoice generation response:', response.data);
      alert('Invoice generated successfully!');
    } catch (error) {
      console.error('Error generating invoice:', error);
      setError('Failed to generate invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSubmit = async () => {
    try {
      const testOrder = {
        ...form,
        product: form.product,
        payment: form.payment,
      };
  
      console.log("Submitting order:", JSON.stringify(testOrder, null, 2));
      const response = await axios.post(ORDER_API, testOrder);
      console.log("Order created successfully:", response.data);
      alert("Order created successfully!");
      fetchOrders();
    } catch (error: unknown) {
      console.error("Error submitting order:", error);
      const axiosError = error as { response?: { data: ErrorResponse; status: number } };
      
      if (axiosError.response) {
        console.error("Error response data:", axiosError.response.data);
        alert("Error: " + (axiosError.response.data?.error || "Check console for details."));
      } else {
        alert("Error creating test order. See console for details.");
      }
    }
  };
  

  // Mask credit card number for display
  const maskCardNumber = (cardNumber: string) => {
    if (!cardNumber) return '';
    const last4 = cardNumber.slice(-4);
    return `xxxx-xxxx-xxxx-${last4}`;
  };

  return (
    <div className="order-management-container">
      <div className="left-column">
        <section className="order-section">
          <h2>Orders</h2>
          {error && <div className="error-message">{error}</div>}
          {loading && <div className="loading-indicator">Loading...</div>}
          
          <form onSubmit={handleSubmit}>
            <h3>Customer Information</h3>
            <input 
              name="firstName" 
              value={form.firstName} 
              onChange={handleChange} 
              placeholder="First Name" 
              required 
            />
            <input 
              name="lastName" 
              value={form.lastName} 
              onChange={handleChange} 
              placeholder="Last Name" 
              required 
            />
            <input 
              name="email" 
              type="email" 
              value={form.email} 
              onChange={handleChange} 
              placeholder="Email" 
              required 
            />
            <input 
              name="phoneNumber" 
              type="number"
              value={form.phoneNumber} 
              onChange={handleChange} 
              maxLength={10}
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Phone Number" 
              required 
            />
            <input 
              name="address" 
              value={form.address} 
              onChange={handleChange} 
              placeholder="Address" 
              required 
            />
            <input 
              name="city" 
              value={form.city} 
              onChange={handleChange} 
              placeholder="City" 
              required 
            />
            <input 
              name="state" 
              value={form.state} 
              onChange={handleChange} 
              placeholder="State" 
              required 
            />
            <input 
              name="country" 
              value={form.country} 
              onChange={handleChange} 
              placeholder="Country" 
              required 
            />
            <input 
              name="zipCode" 
              type="number"
              value={form.zipCode} 
              onChange={handleChange} 
              placeholder="Zip Code" 
              required 
            />
            
            <h3>Payment Information</h3>
            <input 
              name="payment.cardFirstName" 
              value={form.payment.cardFirstName} 
              onChange={handleChange} 
              placeholder="Card First Name" 
              required 
            />
            <input 
              name="payment.cardLastName" 
              value={form.payment.cardLastName} 
              onChange={handleChange} 
              placeholder="Card Last Name" 
              required 
            />
            <input 
              name="payment.billingAddress" 
              value={form.payment.billingAddress} 
              onChange={handleChange} 
              placeholder="Billing Address" 
              required 
            />
            <input 
              name="payment.billingCity" 
              value={form.payment.billingCity} 
              onChange={handleChange} 
              placeholder="Billing City" 
              required 
            />
            <input 
              name="payment.billingState" 
              value={form.payment.billingState} 
              onChange={handleChange} 
              placeholder="Billing State" 
              required 
            />
            <input 
              name="payment.billingCountry" 
              value={form.payment.billingCountry} 
              onChange={handleChange} 
              placeholder="Billing Country" 
              required 
            />
            <input 
              name="payment.billingZipCode" 
              type="number"
              value={form.payment.billingZipCode} 
              onChange={handleChange} 
              placeholder="Billing Zip Code" 
              required 
            />
            <input 
              name="payment.cardNumber" 
              value={form.payment.cardNumber} 
              onChange={handleChange} 
              maxLength={16}
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Card Number" 
              required 
            />
            <input 
              name="payment.securityNumber" 
              value={form.payment.securityNumber} 
              onChange={handleChange} 
              maxLength={3}
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Security Number" 
              required 
            />
            <input 
              name="payment.expDate" 
              maxLength={4}
              value={form.payment.expDate} 
              onChange={handleChange} 
              placeholder="Expiration Date (MM/YY)" 
              required 
            />
            
            <h3>Product Information</h3>
            <input 
              name="product" 
              value={form.product} 
              onChange={handleChange} 
              placeholder="Product" 
              required 
            />
            <input 
              name="price" 
              type="number" 
              step="0.01" 
              min="0.01" 
              value={form.price} 
              onChange={handleChange} 
              placeholder="Price" 
              required 
            />
            <input 
              name="shippingCost" 
              type="number" 
              step="0.01" 
              min="0" 
              value={form.shippingCost} 
              onChange={handleChange} 
              placeholder="Shipping Cost" 
              required 
            />
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="received">Received</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {editingId ? 'Update Order' : 'Create Order'}
              </button>
              
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingId(null);
                    // Reset form to initial state
                    setForm({
                      firstName: '',
                      lastName: '',
                      email: '',
                      address: '',
                      city: '',
                      state: '',
                      country: '',
                      zipCode: '',
                      phoneNumber: '',
                      status: 'received',
                      product: '',
                      price: '',
                      shippingCost: '',
                      payment: {
                        cardFirstName: '',
                        cardLastName: '',
                        billingAddress: '',
                        billingCity: '',
                        billingState: '',
                        billingCountry: '',
                        billingZipCode: '',
                        cardNumber: '',
                        securityNumber: '',
                        expDate: ''
                      }
                    });
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
          
          <div className="orders-list">
            <h3>Orders</h3>
            {orders.length === 0 ? (
              <p>No orders found.</p>
            ) : (
              <ul>
                {orders.map((order) => (
                  <li key={order.orderId || order.id} className="order-item">
                    <div className="order-header">
                      <strong>ID #{order.orderId || order.id}</strong>
                      <span className="status-badge">&nbsp;[{order.status}]</span>
                    </div>
                    <div className="order-details">
                      <p><strong>Customer:</strong> {order.firstName} {order.lastName}</p>
                      <p><strong>Email:</strong> {order.email}</p>
                      <p><strong>Address:</strong> {order.address}, {order.city}, {order.state}</p>
                      <p><strong>Product:</strong> {order.product}</p>
                      <p><strong>Total:</strong> ${order.totalCost || 
                        ((Number(order.price) + Number(order.shippingCost)) * 1.08).toFixed(2)}</p>
                    </div>
                    <div className="order-actions">
                      <button onClick={() => handleEdit(order)}>Edit</button>
                      <button onClick={() => handleDelete(order.orderId || '')}>Delete</button>
                      <button onClick={() => handleGenerateInvoice(order.orderId || '')}>Generate Invoice</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}