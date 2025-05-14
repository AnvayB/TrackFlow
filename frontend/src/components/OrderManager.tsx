import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Orders.css';
import { 
  Package, Truck, ShoppingBag, CreditCard, User, 
  Calendar, DollarSign, MapPin, RefreshCw, FileText, 
  Edit, Trash2, AlertTriangle, CheckCircle
} from 'lucide-react';

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
  const [activeFormTab, setActiveFormTab] = useState<string>('customer');
  const [success, setSuccess] = useState<string | null>(null);
  const [showCompletedAnimation, setShowCompletedAnimation] = useState<boolean>(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (success) {
      // Clear success message after 5 seconds
      const timeout = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [success]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${ORDER_API}/all`);
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
        setSuccess(`Order #${editingId} updated successfully`);
      } else {
        const response = await axios.post(ORDER_API, fullOrder);
        console.log('Order created:', response.data);
        setSuccess(`New order created successfully`);
        setShowCompletedAnimation(true);
        setTimeout(() => setShowCompletedAnimation(false), 2000);
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

      // Reset to first tab after successful submission
      setActiveFormTab('customer');
      
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
    setActiveFormTab('customer');
  };

  const handleDelete = async (orderId: string) => {
    if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      try {
        setLoading(true);
        console.log('Deleting order:', orderId);
        await axios.delete(`${ORDER_API}/${orderId}`);
        setSuccess(`Order #${orderId} deleted successfully`);
        fetchOrders();
      } catch (error) {
        console.error('Error deleting order:', error);
        setError('Failed to delete order.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGenerateInvoice = async (orderId: string) => {
    try {
      setLoading(true);
      console.log('Generating invoice for order:', orderId);
      const response = await axios.post(`${ORDER_API}/${orderId}/invoice`);
      console.log('Invoice generation response:', response.data);
      setSuccess(`Invoice for order #${orderId} generated successfully`);
    } catch (error) {
      console.error('Error generating invoice:', error);
      setError('Failed to generate invoice.');
    } finally {
      setLoading(false);
    }
  };

  // Function to get appropriate status badge class
  const getStatusBadgeClass = (status: string) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  // Get status icon based on status
  const getStatusIcon = (status: string) => {
    switch(status.toLowerCase()) {
      case 'received':
        return <Package size={18} />;
      case 'processing':
        return <RefreshCw size={18} />;
      case 'shipped':
        return <Package size={18} />;
      case 'in-transit':
        return <Truck size={18} />;
      case 'delivered':
        return <CheckCircle size={18} />;
      case 'cancelled':
        return <AlertTriangle size={18} />;
      default:
        return <Package size={18} />;
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number | string) => {
    if (!amount) return '$0.00';
    return `$${Number(amount).toFixed(2)}`;
  };

  // Calculate total cost
  const calculateTotal = (price: number | string, shippingCost: number | string) => {
    const numPrice = Number(price) || 0;
    const numShipping = Number(shippingCost) || 0;
    return formatCurrency((numPrice + numShipping) * 1.08); // Adding 8% tax
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render form section based on active tab
  const renderFormSection = () => {
    switch (activeFormTab) {
      case 'customer':
        return (
          <>
            <div className="form-section">
              <h3><User className="section-icon" /> Customer Information</h3>
            </div>
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <div className="input-wrapper">
                <input 
                  id="firstName"
                  name="firstName" 
                  value={form.firstName} 
                  onChange={handleChange} 
                  placeholder="First Name" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <div className="input-wrapper">
                <input 
                  id="lastName"
                  name="lastName" 
                  value={form.lastName} 
                  onChange={handleChange} 
                  placeholder="Last Name" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <input 
                  id="email"
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={handleChange} 
                  placeholder="Email" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <div className="input-wrapper">
                <input 
                  id="phoneNumber"
                  name="phoneNumber" 
                  type="tel"
                  value={form.phoneNumber} 
                  onChange={handleChange} 
                  placeholder="Phone Number" 
                  required 
                />
              </div>
            </div>
            <div className="form-group address-field">
              <label htmlFor="address">Address</label>
              <div className="input-wrapper">
                <input 
                  id="address"
                  name="address" 
                  value={form.address} 
                  onChange={handleChange} 
                  placeholder="Address" 
                  required 
                />
                <MapPin className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="city">City</label>
              <div className="input-wrapper">
                <input 
                  id="city"
                  name="city" 
                  value={form.city} 
                  onChange={handleChange} 
                  placeholder="City" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="state">State</label>
              <div className="input-wrapper">
                <input 
                  id="state"
                  name="state" 
                  value={form.state} 
                  onChange={handleChange} 
                  placeholder="State" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <div className="input-wrapper">
                <input 
                  id="country"
                  name="country" 
                  value={form.country} 
                  onChange={handleChange} 
                  placeholder="Country" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="zipCode">Zip Code</label>
              <div className="input-wrapper">
                <input 
                  id="zipCode"
                  name="zipCode" 
                  value={form.zipCode} 
                  onChange={handleChange} 
                  placeholder="Zip Code" 
                  required 
                />
              </div>
            </div>
          </>
        );
      case 'payment':
        return (
          <>
            <div className="form-section">
              <h3><CreditCard className="section-icon" /> Payment Information</h3>
            </div>
            <div className="form-group">
              <label htmlFor="payment.cardFirstName">Cardholder First Name</label>
              <div className="input-wrapper">
                <input 
                  id="payment.cardFirstName"
                  name="payment.cardFirstName" 
                  value={form.payment.cardFirstName} 
                  onChange={handleChange} 
                  placeholder="Cardholder First Name" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.cardLastName">Cardholder Last Name</label>
              <div className="input-wrapper">
                <input 
                  id="payment.cardLastName"
                  name="payment.cardLastName" 
                  value={form.payment.cardLastName} 
                  onChange={handleChange} 
                  placeholder="Cardholder Last Name" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.cardNumber">Card Number</label>
              <div className="input-wrapper card-number">
                <input 
                  id="payment.cardNumber"
                  name="payment.cardNumber" 
                  value={form.payment.cardNumber} 
                  onChange={handleChange} 
                  maxLength={16}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="Card Number" 
                  required 
                />
                <CreditCard className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.expDate">Expiration Date (MMYY)</label>
              <div className="input-wrapper">
                <input 
                  id="payment.expDate"
                  name="payment.expDate" 
                  maxLength={4}
                  value={form.payment.expDate} 
                  onChange={handleChange} 
                  placeholder="MMYY" 
                  required 
                />
                <Calendar className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.securityNumber">Security Code</label>
              <div className="input-wrapper">
                <input 
                  id="payment.securityNumber"
                  name="payment.securityNumber" 
                  value={form.payment.securityNumber} 
                  onChange={handleChange} 
                  maxLength={3}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="CVV" 
                  required 
                />
              </div>
            </div>
            <div className="form-group address-field">
              <label htmlFor="payment.billingAddress">Billing Address</label>
              <div className="input-wrapper">
                <input 
                  id="payment.billingAddress"
                  name="payment.billingAddress" 
                  value={form.payment.billingAddress} 
                  onChange={handleChange} 
                  placeholder="Billing Address" 
                  required 
                />
                <MapPin className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.billingCity">Billing City</label>
              <div className="input-wrapper">
                <input 
                  id="payment.billingCity"
                  name="payment.billingCity" 
                  value={form.payment.billingCity} 
                  onChange={handleChange} 
                  placeholder="Billing City" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.billingState">Billing State</label>
              <div className="input-wrapper">
                <input 
                  id="payment.billingState"
                  name="payment.billingState" 
                  value={form.payment.billingState} 
                  onChange={handleChange} 
                  placeholder="Billing State" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.billingCountry">Billing Country</label>
              <div className="input-wrapper">
                <input 
                  id="payment.billingCountry"
                  name="payment.billingCountry" 
                  value={form.payment.billingCountry} 
                  onChange={handleChange} 
                  placeholder="Billing Country" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="payment.billingZipCode">Billing Zip Code</label>
              <div className="input-wrapper">
                <input 
                  id="payment.billingZipCode"
                  name="payment.billingZipCode" 
                  value={form.payment.billingZipCode} 
                  onChange={handleChange} 
                  placeholder="Billing Zip Code" 
                  required 
                />
              </div>
            </div>
          </>
        );
      case 'product':
        return (
          <>
            <div className="form-section">
              <h3><ShoppingBag className="section-icon" /> Product Information</h3>
            </div>
            <div className="form-group">
              <label htmlFor="product">Product Name</label>
              <div className="input-wrapper">
                <input 
                  id="product"
                  name="product" 
                  value={form.product} 
                  onChange={handleChange} 
                  placeholder="Product Name" 
                  required 
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="price">Price ($)</label>
              <div className="input-wrapper">
                <input 
                  id="price"
                  name="price" 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  value={form.price} 
                  onChange={handleChange} 
                  placeholder="Price" 
                  required 
                />
                <DollarSign className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="shippingCost">Shipping Cost ($)</label>
              <div className="input-wrapper">
                <input 
                  id="shippingCost"
                  name="shippingCost" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={form.shippingCost} 
                  onChange={handleChange} 
                  placeholder="Shipping Cost" 
                  required 
                />
                <Truck className="input-icon" size={16} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="status">Order Status</label>
              <div className="input-wrapper status-select">
                <select 
                  id="status"
                  name="status" 
                  value={form.status} 
                  onChange={handleChange}
                  className={`status-select-${form.status.toLowerCase()}`}
                >
                  <option value="received">Received</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="in-transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {getStatusIcon(form.status)}
              </div>
            </div>
            
            {Number(form.price) > 0 && Number(form.shippingCost) >= 0 && (
              <div className="form-group order-summary">
                <h4>Order Summary</h4>
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(form.price)}</span>
                </div>
                <div className="summary-row">
                  <span>Shipping:</span>
                  <span>{formatCurrency(form.shippingCost)}</span>
                </div>
                <div className="summary-row">
                  <span>Tax (8%):</span>
                  <span>{formatCurrency((Number(form.price) + Number(form.shippingCost)) * 0.08)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span>{calculateTotal(form.price, form.shippingCost)}</span>
                </div>
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="order-management-container">
      <div className="left-column">
        <section className="order-section">
          <h2><Package className="title-icon" /> Order Management System</h2>
          
          {error && (
            <div className="error-message">
              <AlertTriangle className="message-icon" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="success-message">
              <CheckCircle className="message-icon" />
              {success}
            </div>
          )}
          
          {showCompletedAnimation && (
            <div className="success-animation">
              <div className="checkmark-circle">
                <div className="checkmark draw"></div>
              </div>
            </div>
          )}
          
          <div className="form-tabs">
            <button 
              className={`tab-button ${activeFormTab === 'customer' ? 'active' : ''}`}
              onClick={() => setActiveFormTab('customer')}
              type="button"
            >
              <User className="tab-icon" size={16} />
              Customer
            </button>
            <button 
              className={`tab-button ${activeFormTab === 'payment' ? 'active' : ''}`}
              onClick={() => setActiveFormTab('payment')}
              type="button"
            >
              <CreditCard className="tab-icon" size={16} />
              Payment
            </button>
            <button 
              className={`tab-button ${activeFormTab === 'product' ? 'active' : ''}`}
              onClick={() => setActiveFormTab('product')}
              type="button"
            >
              <ShoppingBag className="tab-icon" size={16} />
              Product
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="order-form">
            {renderFormSection()}
            
            <div className="form-actions">
              {activeFormTab !== 'customer' && (
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => setActiveFormTab(activeFormTab === 'payment' ? 'customer' : 'payment')}
                >
                  Previous
                </button>
              )}
              
              {activeFormTab !== 'product' ? (
                <button 
                  type="button" 
                  className="primary" 
                  onClick={() => setActiveFormTab(activeFormTab === 'customer' ? 'payment' : 'product')}
                >
                  Next
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="success" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="button-spinner"></div>
                      Processing...
                    </>
                  ) : (
                    editingId ? 'Update Order' : 'Create Order'
                  )}
                </button>
              )}
              
              {editingId && (
                <button 
                  type="button" 
                  className="secondary"
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
            <h3>
              Recent Orders
              <button className="refresh-button secondary" onClick={fetchOrders} disabled={loading}>
                <RefreshCw className="button-icon" size={16} />
                Refresh
              </button>
            </h3>
            
            {loading && !orders.length ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="empty-state">
                <Package size={48} className="empty-icon" />
                <p>No orders found. Create your first order to get started.</p>
                <button 
                  className="primary" 
                  onClick={() => setActiveFormTab('customer')}
                >
                  Create New Order
                </button>
              </div>
            ) : (
              <div className="order-grid">
                {orders.map((order) => (
                  <div key={order.orderId || order.id} className="order-item">
                    <div className="order-header">
                      <strong>#{order.orderId || order.id}</strong>
                      <span className={getStatusBadgeClass(order.status)}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="order-content">
                      <div className="order-details">
                        <div className="order-customer">
                          <div className="customer-avatar">
                            {order.firstName?.charAt(0)}{order.lastName?.charAt(0)}
                          </div>
                          <div className="customer-info">
                            <p className="customer-name">{order.firstName} {order.lastName}</p>
                            <p className="customer-email">{order.email}</p>
                          </div>
                        </div>
                        
                        <div className="order-info-grid">
                          <div className="order-info-item">
                            <span className="label">Product:</span>
                            <span className="value product-value">{order.product}</span>
                          </div>
                          <div className="order-info-item">
                            <span className="label">Price:</span>
                            <span className="value">{formatCurrency(order.price)}</span>
                          </div>
                          <div className="order-info-item">
                            <span className="label">Shipping:</span>
                            <span className="value">{formatCurrency(order.shippingCost)}</span>
                          </div>
                          <div className="order-info-item total-item">
                            <span className="label">Total:</span>
                            <span className="value price-total">{order.totalCost || calculateTotal(order.price, order.shippingCost)}</span>
                          </div>
                          <div className="order-info-item">
                            <span className="label">Date:</span>
                            <span className="value">{formatDate(order.createdAt)}</span>
                          </div>
                          <div className="order-info-item">
                            <span className="label">Address:</span>
                            <span className="value address-value">
                              {`${order.address}, ${order.city}, ${order.state}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="order-actions">
                      <button 
                        onClick={() => handleEdit(order)} 
                        className="edit-button"
                        title="Edit Order"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(order.orderId || '')} 
                        className="delete-button"
                        title="Delete Order"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                      <button 
                        onClick={() => handleGenerateInvoice(order.orderId || '')} 
                        className="invoice-button"
                        title="Generate Invoice"
                      >
                        <FileText size={16} />
                        Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}