/**
 * Simplified Orders Microservice with in-memory storage
 * No AWS credentials or Docker required
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// In-memory storage for orders
const orders = {};

// Input validation rules for creating/updating orders
const orderValidationRules = [
  // User information validation
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('address').trim().notEmpty().withMessage('Home address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('zipCode').trim().notEmpty().withMessage('Zip code is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  
  // Payment information validation
  body('payment.cardFirstName').trim().notEmpty().withMessage('Card first name is required'),
  body('payment.cardLastName').trim().notEmpty().withMessage('Card last name is required'),
  body('payment.billingAddress').trim().notEmpty().withMessage('Billing address is required'),
  body('payment.billingCity').trim().notEmpty().withMessage('Billing city is required'),
  body('payment.billingState').trim().notEmpty().withMessage('Billing state is required'),
  body('payment.billingCountry').trim().notEmpty().withMessage('Billing country is required'),
  body('payment.billingZipCode').trim().notEmpty().withMessage('Billing zip code is required'),
  body('payment.cardNumber').trim().isCreditCard().withMessage('Valid credit card number is required'),
  body('payment.securityNumber').isLength({ min: 3, max: 4 }).withMessage('Valid security code is required'),
  body('payment.expDate').matches(/^(0[1-9]|1[0-2])\/\d{2}$/).withMessage('Expiration date must be in MM/YY format'),
  
  // Product information validation
  body('product').trim().notEmpty().withMessage('Product name is required'),
  body('price').isFloat({ min: 0.01 }).withMessage('Valid product price is required'),
  body('shippingCost').isFloat({ min: 0 }).withMessage('Valid shipping cost is required')
];

// Routes
// 0. Root route to provide API information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Orders microservice is running',
    environment: 'development',
    storage: 'in-memory',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check endpoint' },
      { method: 'GET', path: '/orders', description: 'Get all orders' },
      { method: 'POST', path: '/orders', description: 'Create a new order' },
      { method: 'GET', path: '/orders/:orderId', description: 'Get a specific order' },
      { method: 'PUT', path: '/orders/:orderId', description: 'Update an order' },
      { method: 'PATCH', path: '/orders/:orderId/status', description: 'Update order status' },
      { method: 'DELETE', path: '/orders/:orderId', description: 'Delete an order' },
      { method: 'GET', path: '/orders/status/:status', description: 'Filter orders by status' },
      { method: 'GET', path: '/orders/customer/:email', description: 'Search orders by customer email' }
    ]
  });
});

// 1. Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    environment: 'development',
    storage: 'in-memory'
  });
});

// 2. Create a new order
app.post('/orders', orderValidationRules, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Generate a unique order ID
  const orderId = uuidv4();
  
  // Calculate total cost (product price + shipping + tax)
  const productPrice = parseFloat(req.body.price);
  const shippingCost = parseFloat(req.body.shippingCost);
  const taxRate = 0.08; // 8% tax rate (can be made configurable)
  const taxAmount = productPrice * taxRate;
  const totalCost = productPrice + shippingCost + taxAmount;

  // Prepare order item
  const orderItem = {
    orderId,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    zipCode: req.body.zipCode,
    email: req.body.email,
    phoneNumber: req.body.phoneNumber,
    payment: {
      cardFirstName: req.body.payment.cardFirstName,
      cardLastName: req.body.payment.cardLastName,
      billingAddress: req.body.payment.billingAddress,
      billingCity: req.body.payment.billingCity,
      billingState: req.body.payment.billingState,
      billingCountry: req.body.payment.billingCountry,
      billingZipCode: req.body.payment.billingZipCode,
      // For security, only store last 4 digits of card number
      cardNumberLast4: req.body.payment.cardNumber.slice(-4),
      // Don't store full security number, just indicate it was provided
      securityProvided: true,
      expDate: req.body.payment.expDate
    },
    product: req.body.product,
    price: productPrice,
    shippingCost: shippingCost,
    tax: taxAmount.toFixed(2),
    totalCost: totalCost.toFixed(2),
    status: 'received',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Store order in memory
  orders[orderId] = orderItem;

  res.status(201).json({
    message: 'Order created successfully',
    orderId,
    totalCost: totalCost.toFixed(2)
  });
});

// 3. Get all orders
app.get('/orders', (req, res) => {
  res.status(200).json(Object.values(orders));
});

// 4. Get a specific order by ID
app.get('/orders/:orderId', (req, res) => {
  const order = orders[req.params.orderId];
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.status(200).json(order);
});

// 5. Update an order
app.put('/orders/:orderId', orderValidationRules, (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const orderId = req.params.orderId;
  const order = orders[orderId];

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Calculate updated total cost
  const productPrice = parseFloat(req.body.price);
  const shippingCost = parseFloat(req.body.shippingCost);
  const taxRate = 0.08; // 8% tax rate (can be made configurable)
  const taxAmount = productPrice * taxRate;
  const totalCost = productPrice + shippingCost + taxAmount;

  // Update order
  orders[orderId] = {
    ...orders[orderId],
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    zipCode: req.body.zipCode,
    email: req.body.email,
    phoneNumber: req.body.phoneNumber,
    payment: {
      cardFirstName: req.body.payment.cardFirstName,
      cardLastName: req.body.payment.cardLastName,
      billingAddress: req.body.payment.billingAddress,
      billingCity: req.body.payment.billingCity,
      billingState: req.body.payment.billingState,
      billingCountry: req.body.payment.billingCountry,
      billingZipCode: req.body.payment.billingZipCode,
      cardNumberLast4: req.body.payment.cardNumber.slice(-4),
      securityProvided: true,
      expDate: req.body.payment.expDate
    },
    product: req.body.product,
    price: productPrice,
    shippingCost: shippingCost,
    tax: taxAmount.toFixed(2),
    totalCost: totalCost.toFixed(2),
    updatedAt: new Date().toISOString()
  };

  res.status(200).json({
    message: 'Order updated successfully',
    order: orders[orderId]
  });
});

// 6. Update order status only
app.patch('/orders/:orderId/status', [
  body('status')
    .trim()
    .notEmpty()
    .isIn(['received', 'processing', 'shipped', 'in-transit', 'delivered', 'cancelled'])
    .withMessage('Valid status is required')
], (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const orderId = req.params.orderId;
  const order = orders[orderId];

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  orders[orderId] = {
    ...orders[orderId],
    status: req.body.status,
    updatedAt: new Date().toISOString()
  };

  res.status(200).json({
    message: 'Order status updated successfully',
    order: orders[orderId]
  });
});

// 7. Delete an order
app.delete('/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const order = orders[orderId];

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const deletedOrder = orders[orderId];
  delete orders[orderId];

  res.status(200).json({
    message: 'Order deleted successfully',
    order: deletedOrder
  });
});

// 8. Filter orders by status
app.get('/orders/status/:status', (req, res) => {
  const validStatuses = ['received', 'processing', 'shipped', 'in-transit', 'delivered', 'cancelled'];
  const status = req.params.status;
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status parameter' });
  }
  
  const filteredOrders = Object.values(orders).filter(order => order.status === status);
  res.status(200).json(filteredOrders);
});

// 9. Search orders by customer email
app.get('/orders/customer/:email', (req, res) => {
  const email = req.params.email;
  const filteredOrders = Object.values(orders).filter(order => order.email === email);
  res.status(200).json(filteredOrders);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Simplified Orders microservice running on port ${PORT} in development mode (in-memory storage)`);
});

// Export for testing purposes
module.exports = app;