/**
 * Orders Microservice - server.js
 * 
 * This microservice handles all order-related operations for the logistics tracking platform.
 * Features:
 * - Dual mode: Development (in-memory) or Production (AWS DynamoDB)
 * - Invoice integration with the Invoices microservice
 * - Complete API for order management
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const axios = require('axios');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Invoices service configuration
const INVOICES_SERVICE_URL = process.env.INVOICES_SERVICE_URL || 'http://localhost:3002';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// In-memory storage for development mode
const inMemoryOrders = {};

// Configure AWS based on environment
if (isDevelopment) {
  console.log('Using in-memory storage for orders');
} else {
  // Configure AWS SDK for production
  console.log('Configuring AWS SDK for DynamoDB storage');
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

// Initialize AWS clients only in production mode
let dynamodb;
let docClient;
const TABLE_NAME = 'Orders';

if (!isDevelopment) {
  dynamodb = new AWS.DynamoDB();
  docClient = new AWS.DynamoDB.DocumentClient();
  
  // Check if the Orders table exists
  async function ensureTableExists() {
    try {
      console.log('Checking if DynamoDB table exists...');
      await dynamodb.describeTable({ TableName: TABLE_NAME }).promise();
      console.log(`Table ${TABLE_NAME} exists`);
      return true;
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        console.log(`Table ${TABLE_NAME} does not exist, creating it...`);
        return createTable();
      }
      console.error('Error checking DynamoDB table:', error);
      throw error;
    }
  }
  
  // Create the Orders table if it doesn't exist
  async function createTable() {
    const tableParams = {
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: 'orderId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'orderId', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    };
    
    try {
      await dynamodb.createTable(tableParams).promise();
      console.log(`Created table: ${TABLE_NAME}`);
      
      // Wait for table to become active
      console.log(`Waiting for table ${TABLE_NAME} to become active...`);
      await dynamodb.waitFor('tableExists', { TableName: TABLE_NAME }).promise();
      console.log(`Table ${TABLE_NAME} is now active`);
      
      return true;
    } catch (error) {
      console.error('Error creating DynamoDB table:', error);
      return false;
    }
  }
}

// Storage operations - abstracts away the difference between in-memory and DynamoDB
const orderStorage = {
  // Create a new order
  async create(order) {
    if (isDevelopment) {
      inMemoryOrders[order.orderId] = order;
      return order;
    } else {
      const params = {
        TableName: TABLE_NAME,
        Item: order
      };
      await docClient.put(params).promise();
      return order;
    }
  },
  
  // Get a specific order by ID
  async get(orderId) {
    if (isDevelopment) {
      return inMemoryOrders[orderId] || null;
    } else {
      const params = {
        TableName: TABLE_NAME,
        Key: { orderId }
      };
      const result = await docClient.get(params).promise();
      return result.Item || null;
    }
  },
  
  // Update an existing order
  async update(orderId, orderData) {
    if (isDevelopment) {
      if (!inMemoryOrders[orderId]) return null;
      inMemoryOrders[orderId] = { ...inMemoryOrders[orderId], ...orderData };
      return inMemoryOrders[orderId];
    } else {
      // First check if the order exists
      const existingOrder = await this.get(orderId);
      if (!existingOrder) return null;
      
      // Prepare update expression
      const updateParams = {
        TableName: TABLE_NAME,
        Key: { orderId },
        ReturnValues: 'ALL_NEW'
      };
      
      // Dynamically build the update expression
      const attributes = Object.keys(orderData);
      updateParams.UpdateExpression = 'set ' + attributes.map(attr => `#${attr} = :${attr}`).join(', ');
      
      // Build ExpressionAttributeNames
      updateParams.ExpressionAttributeNames = {};
      attributes.forEach(attr => {
        updateParams.ExpressionAttributeNames[`#${attr}`] = attr;
      });
      
      // Build ExpressionAttributeValues
      updateParams.ExpressionAttributeValues = {};
      attributes.forEach(attr => {
        updateParams.ExpressionAttributeValues[`:${attr}`] = orderData[attr];
      });
      
      const result = await docClient.update(updateParams).promise();
      return result.Attributes;
    }
  },
  
  // Delete an order
  async delete(orderId) {
    if (isDevelopment) {
      if (!inMemoryOrders[orderId]) return null;
      const deletedOrder = inMemoryOrders[orderId];
      delete inMemoryOrders[orderId];
      return deletedOrder;
    } else {
      const params = {
        TableName: TABLE_NAME,
        Key: { orderId },
        ReturnValues: 'ALL_OLD'
      };
      const result = await docClient.delete(params).promise();
      return result.Attributes || null;
    }
  },
  
  // List all orders
  async list() {
    if (isDevelopment) {
      return Object.values(inMemoryOrders);
    } else {
      const params = {
        TableName: TABLE_NAME
      };
      const result = await docClient.scan(params).promise();
      return result.Items || [];
    }
  },
  
  // Filter orders by status
  async filterByStatus(status) {
    if (isDevelopment) {
      return Object.values(inMemoryOrders).filter(order => order.status === status);
    } else {
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: '#status = :statusValue',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':statusValue': status
        }
      };
      const result = await docClient.scan(params).promise();
      return result.Items || [];
    }
  },
  
  // Filter orders by customer email
  async filterByEmail(email) {
    if (isDevelopment) {
      return Object.values(inMemoryOrders).filter(order => order.email === email);
    } else {
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'email = :emailValue',
        ExpressionAttributeValues: {
          ':emailValue': email
        }
      };
      const result = await docClient.scan(params).promise();
      return result.Items || [];
    }
  }
};

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

// Async function to generate invoice
async function generateInvoice(orderId) {
  try {
    console.log(`Requesting invoice generation for order: ${orderId}`);
    const response = await axios.post(
      `${INVOICES_SERVICE_URL}/invoices/generate/${orderId}`
    );
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error generating invoice:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Routes
// 0. Root route to provide API information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Orders microservice is running',
    environment: isDevelopment ? 'development' : 'production',
    storage: isDevelopment ? 'in-memory' : 'AWS DynamoDB',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check endpoint' },
      { method: 'GET', path: '/orders', description: 'Get all orders' },
      { method: 'POST', path: '/orders', description: 'Create a new order' },
      { method: 'GET', path: '/orders/:orderId', description: 'Get a specific order' },
      { method: 'PUT', path: '/orders/:orderId', description: 'Update an order' },
      { method: 'PATCH', path: '/orders/:orderId/status', description: 'Update order status' },
      { method: 'DELETE', path: '/orders/:orderId', description: 'Delete an order' },
      { method: 'GET', path: '/orders/status/:status', description: 'Filter orders by status' },
      { method: 'GET', path: '/orders/customer/:email', description: 'Search orders by customer email' },
      { method: 'POST', path: '/orders/:orderId/invoice', description: 'Generate invoice for an order' }
    ]
  });
});

// 1. Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    environment: isDevelopment ? 'development' : 'production',
    storage: isDevelopment ? 'in-memory' : 'AWS DynamoDB',
    invoicesService: INVOICES_SERVICE_URL
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

  try {
    // Store order using the appropriate storage method
    await orderStorage.create(orderItem);

    // After successfully creating the order, try to generate an invoice
    let invoiceResult = { generated: false };
    
    try {
      const invoiceResponse = await generateInvoice(orderId);
      
      if (invoiceResponse.success) {
        console.log('Invoice generated successfully', invoiceResponse.data);
        invoiceResult = {
          generated: true,
          message: 'Invoice has been generated and sent',
          details: invoiceResponse.data
        };
      } else {
        console.log('Invoice generation failed', invoiceResponse.error);
        invoiceResult = {
          generated: false,
          message: 'Failed to generate invoice, it will be processed later',
          error: invoiceResponse.error
        };
      }
    } catch (invoiceError) {
      console.error('Exception during invoice generation:', invoiceError);
      invoiceResult = {
        generated: false,
        message: 'Error occurred during invoice generation',
        error: invoiceError.message
      };
    }

    // Respond with order details and invoice status
    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      totalCost: totalCost.toFixed(2),
      invoice: invoiceResult
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// 3. Get all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await orderStorage.list();
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// 4. Get a specific order by ID
app.get('/orders/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await orderStorage.get(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).json({ error: 'Failed to retrieve order', details: error.message });
  }
});

// 5. Update an order
app.put('/orders/:orderId', orderValidationRules, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const orderId = req.params.orderId;
    
    // Check if order exists
    const existingOrder = await orderStorage.get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate updated total cost
    const productPrice = parseFloat(req.body.price);
    const shippingCost = parseFloat(req.body.shippingCost);
    const taxRate = 0.08; // 8% tax rate (can be made configurable)
    const taxAmount = productPrice * taxRate;
    const totalCost = productPrice + shippingCost + taxAmount;

    // Prepare updated order data
    const updatedOrderData = {
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

    // Update the order
    const updatedOrder = await orderStorage.update(orderId, updatedOrderData);

    res.status(200).json({
      message: 'Order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order', details: error.message });
  }
});

// 6. Update order status only
app.patch('/orders/:orderId/status', [
  body('status')
    .trim()
    .notEmpty()
    .isIn(['received', 'processing', 'shipped', 'in-transit', 'delivered', 'cancelled'])
    .withMessage('Valid status is required')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const orderId = req.params.orderId;
    
    // Check if order exists
    const existingOrder = await orderStorage.get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update only the status
    const updatedOrder = await orderStorage.update(orderId, {
      status: req.body.status,
      updatedAt: new Date().toISOString()
    });

    res.status(200).json({
      message: 'Order status updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// 7. Delete an order
app.delete('/orders/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Delete the order and get the deleted item
    const deletedOrder = await orderStorage.delete(orderId);
    
    if (!deletedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({
      message: 'Order deleted successfully',
      order: deletedOrder
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order', details: error.message });
  }
});

// 8. Filter orders by status
app.get('/orders/status/:status', async (req, res) => {
  const validStatuses = ['received', 'processing', 'shipped', 'in-transit', 'delivered', 'cancelled'];
  const status = req.params.status;
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status parameter' });
  }
  
  try {
    const filteredOrders = await orderStorage.filterByStatus(status);
    res.status(200).json(filteredOrders);
  } catch (error) {
    console.error('Error retrieving orders by status:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// 9. Search orders by customer email
app.get('/orders/customer/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const filteredOrders = await orderStorage.filterByEmail(email);
    res.status(200).json(filteredOrders);
  } catch (error) {
    console.error('Error retrieving orders by email:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// 10. Manually generate invoice for an order
app.post('/orders/:orderId/invoice', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Check if order exists
    const order = await orderStorage.get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const invoiceResponse = await generateInvoice(orderId);
    
    if (invoiceResponse.success) {
      res.status(200).json({
        message: 'Invoice generated successfully',
        invoice: invoiceResponse.data
      });
    } else {
      res.status(500).json({
        message: 'Failed to generate invoice',
        error: invoiceResponse.error
      });
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ 
      error: 'Failed to generate invoice', 
      details: error.message 
    });
  }
});

// Initialize and start the server
async function startServer() {
  try {
    // If in production mode, make sure the DynamoDB table exists
    if (!isDevelopment) {
      const tableReady = await ensureTableExists();
      if (!tableReady) {
        console.error('Failed to ensure DynamoDB table exists. Cannot start server in production mode.');
        process.exit(1);
      }
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Orders microservice running on port ${PORT} in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
      console.log(`Storage: ${isDevelopment ? 'In-memory' : 'AWS DynamoDB'}`);
      console.log(`Configured to use Invoices service at: ${INVOICES_SERVICE_URL}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing purposes
module.exports = { app, orderStorage };