const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let orders = [];
let currentId = 1;

// Create Order
app.post('/orders', (req, res) => {
  const {
    customerName,
    email,
    address,
    status = 'Pending',
    product,
    payment
  } = req.body;

  const newOrder = {
    id: currentId++,
    customerName,
    email,
    address,
    status,
    product,
    payment
  };

  orders.push(newOrder);
  res.status(201).json(newOrder);
  console.log('Submitting full order:', newOrder);

});

// Update Order
app.put('/orders/:id', (req, res) => {
  const { id } = req.params;
  const {
    customerName,
    email,
    address,
    status,
    product,
    payment
  } = req.body;

  const order = orders.find(order => order.id === parseInt(id));
  if (order) {
    order.customerName = customerName;
    order.email = email;
    order.address = address;
    order.status = status;
    order.product = product;
    order.payment = payment;
    res.json(order);
  } else {
    res.status(404).send('Order not found');
  }
});


// Get All Orders
app.get('/orders', (req, res) => {
  res.json(orders);
});

// Delete Order
app.delete('/orders/:id', (req, res) => {
  const { id } = req.params;
  orders = orders.filter(order => order.id !== parseInt(id));
  res.status(204).send();
});

app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));