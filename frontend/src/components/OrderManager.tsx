import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import axios from 'axios';

interface Order {
  id: number;
  customerName: string;
  email: string;
  address: string;
  status: string;
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

  const handleProductChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProductFormData({ ...productFormData, [e.target.name]: e.target.value });
  };

  const handlePaymentChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPaymentFormData({ ...paymentFormData, [e.target.name]: e.target.value });
  };

  const handleProductSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('Product submitted:', productFormData);
  };

  const handlePaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('Payment submitted:', paymentFormData);
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
            <button type="submit"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.form?.requestSubmit();
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

        <section className="product-section">
          <h2>Products</h2>
          <form onSubmit={handleProductSubmit}>
            <input
              type="text"
              name="productName"
              placeholder="Product Name"
              value={productFormData.productName}
              onChange={handleProductChange}
              required
            />
            <input
              type="text"
              name="productPrice"
              placeholder="Product Price"
              value={productFormData.productPrice}
              onChange={handleProductChange}
              required
            />
            <button type="submit">Add Product</button>
          </form>
        </section>
      </div>

      <section className="payment-section">
        <h2>Payment</h2>
        <form onSubmit={handlePaymentSubmit}>
          <input type="text" name="cardFirstName" placeholder="Card First Name" value={paymentFormData.cardFirstName} onChange={handlePaymentChange} required />
          <input type="text" name="cardLastName" placeholder="Card Last Name" value={paymentFormData.cardLastName} onChange={handlePaymentChange} required />
          <input type="text" name="billingAddress" placeholder="Billing Address" value={paymentFormData.billingAddress} onChange={handlePaymentChange} required />
          <input type="text" name="billingCity" placeholder="Billing City" value={paymentFormData.billingCity} onChange={handlePaymentChange} required />
          <input type="text" name="billingState" placeholder="Billing State" value={paymentFormData.billingState} onChange={handlePaymentChange} required />
          <input type="text" name="billingCountry" placeholder="Billing Country" value={paymentFormData.billingCountry} onChange={handlePaymentChange} required />
          <input type="text" name="billingZipCode" placeholder="Billing Zip Code" value={paymentFormData.billingZipCode} onChange={handlePaymentChange} required />
          <input type="text" name="cardNumber" placeholder="Card Number" value={paymentFormData.cardNumber} onChange={handlePaymentChange} required />
          <input type="text" name="securityNumber" placeholder="Security Number" value={paymentFormData.securityNumber} onChange={handlePaymentChange} required />
          <input type="text" name="expirationDate" placeholder="MM/YY" value={paymentFormData.expirationDate} onChange={handlePaymentChange} required />
          <div className="submit-button-container">
            <button type="submit">Submit Payment</button>
          </div>
        </form>
      </section>
    </div>
  );
}
