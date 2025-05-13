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
    
    try {
      // Log the form data for debugging
      console.log('Submitting form data:', JSON.stringify(form, null, 2));
      
      if (editingId) {
        // Update existing order
        const response = await axios.put(`${ORDER_API}/${editingId}`, form);
        console.log('Order updated:', response.data);
        setEditingId(null);
      } else {
        // Create new order
        const response = await axios.post(ORDER_API, form);
        console.log('Order created:', response.data);
      }
      
      // Reset form
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
      
      // Refresh orders list
      fetchOrders();
    } catch (error: any) {
      console.error('Error submitting order:', error);
      
      // Log more detailed error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        
        if (error.response.data && error.response.data.errors) {
          const errorMessages = error.response.data.errors.map((err: any) => err.msg).join(', ');
          setError(`Failed to submit order: ${errorMessages}`);
        } else {
          setError(`Failed to submit order: ${error.response.data.error || 'Unknown error'}`);
        }
      } else {
        setError(`Failed to submit order: ${error.message || 'Unknown error'}`);
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

  // Test function to create a sample order
  const handleTestSubmit = async () => {
    try {
      // Create a minimal test order
      const testOrder = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phoneNumber: "123-456-7890",
        address: "123 Test St",
        city: "Test City",
        state: "TS",
        country: "USA",
        zipCode: "12345",
        payment: {
          cardFirstName: "Test",
          cardLastName: "User",
          billingAddress: "123 Test St",
          billingCity: "Test City",
          billingState: "TS",
          billingCountry: "USA",
          billingZipCode: "12345",
          cardNumber: "4111111111111111",
          securityNumber: "123",
          expDate: "12/25"
        },
        product: "Test Product",
        price: 99.99,
        shippingCost: 10.00,
        status: "received"
      };
      
      console.log("Submitting test order:", testOrder);
      const response = await axios.post(ORDER_API, testOrder);
      console.log("Test order created successfully:", response.data);
      alert("Test order created successfully!");
      fetchOrders();
    } catch (error) {
      console.error("Error submitting test order:", error);
      alert("Error creating test order. See console for details.");
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
              value={form.phoneNumber} 
              onChange={handleChange} 
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
              value={form.payment.billingZipCode} 
              onChange={handleChange} 
              placeholder="Billing Zip Code" 
              required 
            />
            <input 
              name="payment.cardNumber" 
              value={form.payment.cardNumber} 
              onChange={handleChange} 
              placeholder="Card Number" 
              required 
            />
            <input 
              name="payment.securityNumber" 
              value={form.payment.securityNumber} 
              onChange={handleChange} 
              placeholder="Security Number" 
              required 
            />
            <input 
              name="payment.expDate" 
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
              <button type="submit" disabled={loading} onClick={handleTestSubmit}>
                {editingId ? 'Update Order' : 'Create Order'}
              </button>
              
              {editingId && (
                <button type="button" onClick={() => setEditingId(null)}>
                  Cancel Edit
                </button>
              )}
              
              {/* <button type="button" onClick={handleTestSubmit}>
                Test Order Creation
              </button> */}
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