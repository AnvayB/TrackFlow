import { ChangeEvent, FormEvent, useState } from 'react';
import './micro.css';

interface InvoiceForm {
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function InvoiceManager() {
  const [form, setForm] = useState<InvoiceForm>({
    orderId: '',
    firstName: '',
    lastName: '',
    email: ''
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleExport = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle export functionality here
    console.log('Exporting invoice:', form);
  };

  return (
    <section>
      <h2>Invoice Management</h2>
      <form onSubmit={handleExport}>
        <input
          name="orderId"
          value={form.orderId}
          onChange={handleChange}
          placeholder="Order ID"
          required
        />
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
        <button type="submit">Export Invoice</button>
      </form>
    </section>
  );
}
