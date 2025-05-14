import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Invoices.css';
import {
  FileText,
  Search,
  User,
  Mail,
  Package,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Phone,
  MapPin,
  DollarSign,
  Truck,
  CreditCard,
  Tag,
  Percent,
  Download,
  Loader
} from 'lucide-react';

interface Order {
  orderId: string;
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
    securityNumber?: string;
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
const INVOICE_API = 'http://localhost:3003/invoices';

export default function InvoiceManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchInput, setSearchInput] = useState({
    orderId: '',
    name: '',
    email: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${ORDER_API}/all`);
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

  const clearSearch = () => {
    setSearchInput({
      orderId: '',
      name: '',
      email: '',
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesId = searchInput.orderId
      ? order.orderId?.toString().toLowerCase().includes(searchInput.orderId.toLowerCase())
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

  const handleGenerateInvoice = async (orderId: string) => {
    try {
      setGeneratingInvoice(orderId);
      setError(null);
      
      const response = await axios.post(`${INVOICE_API}/generate/${orderId.toString()}`);
      
      if (response.data.success) {
        setSuccess(`Invoice for order #${orderId} generated successfully`);
        
        if (response.data.filePath?.startsWith('local://')) {
          setSuccess(`Invoice for order #${orderId} generated successfully! Check the server console for file location.`);
        } else if (response.data.s3Url) {
          window.open(response.data.s3Url, '_blank');
          setSuccess(`Invoice for order #${orderId} generated and opened in new tab`);
        }

        if (response.data.emailSent) {
          setSuccess(`Invoice for order #${orderId} has been sent to the customer's email`);
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

  const toggleExpand = (orderId: string) => {
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

  const getStatusBadgeClass = (status: string) => {
    return `status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  };

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

  const formatEmailForDisplay = (email: string) => {
    // Instead of truncating the email, we'll make sure it displays correctly
    // in the context where it's shown
    return email;
  };

  return (
    <div className="invoice-manager-container">
      <div className="invoice-manager-content">
        <div className="invoice-section">
          <h2><FileText className="title-icon" /> Invoice Management System</h2>
          
          {error && (
            <div className="error-message">
              <AlertTriangle className="message-icon" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="success-message">
              <FileText className="message-icon" />
              {success}
            </div>
          )}
          
          <div className="search-container">
            <div className="search-header">
              <h3><Search className="section-icon" /> Search Orders</h3>
              <div className="search-actions">
                <button className="refresh-button secondary" onClick={fetchOrders} disabled={loading}>
                  <RefreshCw className="button-icon" size={16} />
                  Refresh
                </button>
                {(searchInput.orderId || searchInput.name || searchInput.email) && (
                  <button className="clear-button secondary" onClick={clearSearch}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            
            <div className="search-bar">
              <div className="search-input-wrapper">
                <Package className="search-icon" size={18} />
                <input 
                  name="orderId" 
                  placeholder="Order ID" 
                  value={searchInput.orderId}
                  onChange={handleInputChange} 
                />
              </div>
              <div className="search-input-wrapper">
                <User className="search-icon" size={18} />
                <input 
                  name="name" 
                  placeholder="Customer Name" 
                  value={searchInput.name}
                  onChange={handleInputChange} 
                />
              </div>
              <div className="search-input-wrapper">
                <Mail className="search-icon" size={18} />
                <input 
                  name="email" 
                  placeholder="Email" 
                  value={searchInput.email}
                  onChange={handleInputChange} 
                />
              </div>
            </div>
          </div>

          <div className="orders-result-container">
            <h3>
              <FileText className="section-icon" /> 
              {filteredOrders.length} Order{filteredOrders.length !== 1 ? 's' : ''} Found
            </h3>
            
            {loading && orders.length === 0 ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <p>Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} className="empty-icon" />
                <p>No matching orders found.</p>
                {(searchInput.orderId || searchInput.name || searchInput.email) && (
                  <button className="primary" onClick={clearSearch}>
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="orders-list">
                {filteredOrders.map(order => (
                  <li key={order.orderId.toString()} className="order-item">
                    <div className="order-header">
                      <div className="order-summary">
                        <div className="order-id">
                          <Package className="order-icon" size={18} />
                          <span className="order-number">#{order.orderId}</span>
                          <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                        </div>
                        <div className="order-customer-summary">
                          <div className="customer-avatar">
                            {order.firstName?.charAt(0)}{order.lastName?.charAt(0)}
                          </div>
                          <div className="customer-info-container">
                            <span className="customer-name">{order.firstName} {order.lastName}</span>
                            <span className="customer-email">
                              <Mail className="tiny-icon" size={14} /> 
                              <span className="email-text" title={order.email}>
                                {order.email}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="order-total">
                          <span className="total-amount">{formatCurrency(order.totalCost)}</span>
                          <span className="order-date">{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="order-actions">
                        <button 
                          onClick={() => handleGenerateInvoice(order.orderId.toString())} 
                          disabled={generatingInvoice === order.orderId.toString()}
                          className="generate-invoice-btn"
                        >
                          {generatingInvoice === order.orderId.toString() ? (
                            <>
                              <Loader className="spinning-icon" size={16} />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download size={16} />
                              Generate Invoice
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => toggleExpand(order.orderId.toString())}
                          className={`toggle-details-btn ${expandedOrderId === order.orderId.toString() ? 'active' : ''}`}
                        >
                          {expandedOrderId === order.orderId.toString() ? (
                            <>
                              <ChevronDown size={16} />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronRight size={16} />
                              Show Details
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {expandedOrderId === order.orderId.toString() && (
                      <div className="order-details">
                        <div className="details-grid">
                          <div className="customer-info">
                            <h4><User className="details-icon" /> Customer Information</h4>
                            <div className="info-grid">
                              <div className="info-item">
                                <span className="info-label"><User className="tiny-icon" /> Name</span>
                                <span className="info-value">{order.firstName} {order.lastName}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label"><Mail className="tiny-icon" /> Email</span>
                                <span className="info-value email-wrap">{order.email}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label"><Phone className="tiny-icon" /> Phone</span>
                                <span className="info-value">{order.phoneNumber}</span>
                              </div>
                              <div className="info-item full-width">
                                <span className="info-label"><MapPin className="tiny-icon" /> Address</span>
                                <span className="info-value address">
                                  {order.address}, {order.city}, {order.state}, {order.country} {order.zipCode}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="order-info">
                            <h4><Package className="details-icon" /> Order Information</h4>
                            <div className="info-grid">
                              <div className="info-item">
                                <span className="info-label"><Tag className="tiny-icon" /> Product</span>
                                <span className="info-value">{order.product}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label"><DollarSign className="tiny-icon" /> Price</span>
                                <span className="info-value">{formatCurrency(order.price)}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label"><Truck className="tiny-icon" /> Shipping</span>
                                <span className="info-value">{formatCurrency(order.shippingCost)}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label"><Percent className="tiny-icon" /> Tax</span>
                                <span className="info-value">{formatCurrency(order.tax)}</span>
                              </div>
                              <div className="info-item highlighted-total">
                                <span className="info-label"><DollarSign className="tiny-icon" /> Total</span>
                                <span className="info-value total-value">{formatCurrency(order.totalCost)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="payment-info">
                            <h4><CreditCard className="details-icon" /> Payment Information</h4>
                            <div className="info-grid">
                              <div className="info-item full-width">
                                <span className="info-label"><User className="tiny-icon" /> Card Holder</span>
                                <span className="info-value">{order.payment.cardFirstName} {order.payment.cardLastName}</span>
                              </div>
                              <div className="info-item full-width">
                                <span className="info-label"><CreditCard className="tiny-icon" /> Card Number</span>
                                <span className="info-value card-number">{maskCard(order.payment.cardNumber || order.payment.cardNumberLast4)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="details-actions">
                          <button 
                            onClick={() => handleGenerateInvoice(order.orderId.toString())} 
                            disabled={generatingInvoice === order.orderId.toString()}
                            className="primary"
                          >
                            {generatingInvoice === order.orderId.toString() ? (
                              <>
                                <Loader className="spinning-icon" size={16} />
                                Generating Invoice...
                              </>
                            ) : (
                              <>
                                <Download size={16} />
                                Generate Full Invoice
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}