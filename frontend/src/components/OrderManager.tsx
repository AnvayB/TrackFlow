import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './Orders.css';

interface Order {
  id: number;
  customerName: string;
  email: string;
  address: string;
  status: string;
  product?: ProductFormData;
  payment?: PaymentFormData;
}

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

const ORDER_API = 'http://localhost:3001/orders';

export default function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<Omit<Order, 'id'>>({ customerName: '', email: '', address: '', status: 'Pending' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const [productFormData, setProductFormData] = useState<ProductFormData>({
    productName: '',
    productPrice: '',
  });

  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    cardFirstName: '',
    cardLastName: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingCountry: '',
    billingZipCode: '',
    cardNumber: '',
    securityNumber: '',
    expirationDate: '',
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(ORDER_API);
      setOrders(res.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fullOrder = {
      ...form,
      product: productFormData,
      payment: paymentFormData,
    };
    
    if (editingId) {
      await axios.put(`${ORDER_API}/${editingId}`, fullOrder);
      setEditingId(null);
    } else {
      await axios.post(ORDER_API, fullOrder);
    }
    
    setForm({ customerName: '', email: '', address: '', status: 'Pending' });
    setProductFormData({ productName: '', productPrice: '' });
    setPaymentFormData({
      cardFirstName: '',
      cardLastName: '',
      billingAddress: '',
      billingCity: '',
      billingState: '',
      billingCountry: '',
      billingZipCode: '',
      cardNumber: '',
      securityNumber: '',
      expirationDate: '',
    });
    
    fetchOrders();
  };

  const handleEdit = (order: Order) => {
    setForm({
      customerName: order.customerName,
      email: order.email,
      address: order.address,
      status: order.status
    });
    
    if (order.product) {
      setProductFormData(order.product);
    } else {
      setProductFormData({ productName: '', productPrice: '' });
    }
    
    if (order.payment) {
      setPaymentFormData(order.payment);
    } else {
      setPaymentFormData({
        cardFirstName: '',
        cardLastName: '',
        billingAddress: '',
        billingCity: '',
        billingState: '',
        billingCountry: '',
        billingZipCode: '',
        cardNumber: '',
        securityNumber: '',
        expirationDate: '',
      });
    }
    
    setEditingId(order.id);
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`${ORDER_API}/${id}`);
    fetchOrders();
  };

  const handleProductChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProductFormData({ ...productFormData, [e.target.name]: e.target.value });
  };

  const handlePaymentChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPaymentFormData({ ...paymentFormData, [e.target.name]: e.target.value });
  };

  const handleSubmitAll = async () => {
    try {
      const fullOrder = {
        ...form,
        product: productFormData,
        payment: paymentFormData,
      };

      if (editingId) {
        await axios.put(`${ORDER_API}/${editingId}`, fullOrder);
        setEditingId(null);
      } else {
        await axios.post(ORDER_API, fullOrder);
      }

      // Reset all
      setForm({ customerName: '', email: '', address: '', status: 'Pending' });
      setProductFormData({ productName: '', productPrice: '' });
      setPaymentFormData({
        cardFirstName: '',
        cardLastName: '',
        billingAddress: '',
        billingCity: '',
        billingState: '',
        billingCountry: '',
        billingZipCode: '',
        cardNumber: '',
        securityNumber: '',
        expirationDate: '',
      });

      fetchOrders();
      alert('All data submitted successfully.');
    } catch (error) {
      console.error('Submit All failed:', error);
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
            <button type="submit">{editingId ? 'Update' : 'Add'} Order</button>
          </form>
          <ul>
            {orders.map(order => (
              <li key={order.id} className="order-item">
                <div className="order-header">
                  <strong>ID #{order.id}: {order.customerName}</strong>
                  <span className="status-badge">{order.status}</span>
                </div>
                <div className="order-details">
                  <div className="customer-info">
                    <p>Email: {order.email}</p>
                    <p>Address: {order.address}</p>
                  </div>
                  
                  {order.product && (
                    <div className="product-info">
                      <h4>Product Details</h4>
                      <p>Name: {order.product.productName}</p>
                      <p>Price: ${order.product.productPrice}</p>
                    </div>
                  )}
                  
                  {order.payment && (
                    <div className="payment-info">
                      <h4>Payment Details</h4>
                      <p>Card: {order.payment.cardFirstName} {order.payment.cardLastName}</p>
                      <p>Card Number: {maskCardNumber(order.payment.cardNumber)}</p>
                      <p>Billing: {order.payment.billingCity}, {order.payment.billingState}, {order.payment.billingCountry}</p>
                    </div>
                  )}
                </div>
                <div className="order-actions">
                  <button onClick={() => handleEdit(order)}>Edit</button>
                  <button onClick={() => handleDelete(order.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="product-section">
          <h2>Products</h2>
          <form>
            <input
              type="text"
              name="productName"
              placeholder="Product Name"
              value={productFormData.productName}
              onChange={handleProductChange}
              required
            />
            <input
              type="number"
              name="productPrice"
              placeholder="Product Price"
              value={productFormData.productPrice}
              onChange={handleProductChange}
              required
            />
          </form>
        </section>
      </div>

      <section className="payment-section">
        <h2>Payment</h2>
        <form>
          <input type="text" name="cardFirstName" placeholder="Card First Name" value={paymentFormData.cardFirstName} onChange={handlePaymentChange} required />
          <input type="text" name="cardLastName" placeholder="Card Last Name" value={paymentFormData.cardLastName} onChange={handlePaymentChange} required />
          <input type="text" name="billingAddress" placeholder="Billing Address" value={paymentFormData.billingAddress} onChange={handlePaymentChange} required />
          <input type="text" name="billingCity" placeholder="Billing City" value={paymentFormData.billingCity} onChange={handlePaymentChange} required />
          <input type="text" name="billingState" placeholder="Billing State" value={paymentFormData.billingState} onChange={handlePaymentChange} required />
          <input type="text" name="billingCountry" placeholder="Billing Country" value={paymentFormData.billingCountry} onChange={handlePaymentChange} required />
          <input type="text" name="billingZipCode" placeholder="Billing Zip Code" value={paymentFormData.billingZipCode} onChange={handlePaymentChange} required />
          <input type="number" name="cardNumber" placeholder="Card Number" value={paymentFormData.cardNumber} onChange={handlePaymentChange} required />
          <input type="number" name="securityNumber" placeholder="Security Number" value={paymentFormData.securityNumber} onChange={handlePaymentChange} required />
          <input type="date" name="expirationDate" placeholder="MM/YY" value={paymentFormData.expirationDate} onChange={handlePaymentChange} required />
        </form>
      </section>

      <div className="submit-button-container" style={{ marginTop: '2rem' }}>
        <button type="button" onClick={handleSubmitAll}>Submit All</button>
      </div>
    </div>
  );
}