/**
 * Orders Microservice - server.js
 * 
 * This microservice handles all order-related operations for the logistics tracking platform.
 * Features:
 * - Dual mode: Development (in-memory) or Production (AWS DynamoDB)
 * - Invoice integration with the Invoices microservice
 * - SES integration for email notifications
 * - Complete API for order management
 * - Format conversion for frontend compatibility
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
const INVOICES_SERVICE_URL = process.env.INVOICES_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATIONS_SERVICE_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4000';

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
    region: process.env.AWS_REGION || 'us-east-2',
    // In production, credentials should come from environment variables, EC2 instance role,
    // or AWS Lambda execution role - don't hardcode credentials
  });
}

// Initialize AWS clients only in production mode
let dynamodb;
let docClient;
let ses;
const TABLE_NAME = 'Orders';

if (!isDevelopment) {
  dynamodb = new AWS.DynamoDB();
  docClient = new AWS.DynamoDB.DocumentClient();
  ses = new AWS.SES({ apiVersion: '2010-12-01' });
}
  
// Check if the Orders table exists
async function ensureTableExists() {
  if (isDevelopment) return true; // Skip in development mode
  
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

// Email notification function using SES
async function sendOrderNotification(order, status) {
  // Skip in development mode
  if (isDevelopment) {
    console.log(`[DEV] Would send email to ${order.email} about order ${order.orderId} status: ${status}`);
    return { messageId: 'dev-mode-no-email-sent' };
  }
  
  // First try to use the notification service
  try {
    const response = await axios.post(`${NOTIFICATIONS_SERVICE_URL}/notify`, {
      orderId: order.orderId,
      customerEmail: order.email,
      status: status
    });
    console.log(`Notification service response:`, response.data);
    return { messageId: response.data.details?.messageId || 'notification-service-used' };
  } catch (error) {
    console.warn(`Notification service unavailable, falling back to direct SES: ${error.message}`);
    // If notification service fails, fall back to direct SES
  }
  
  // Build the email content based on order status
  let subject, htmlBody;
  
  switch(status) {
    case 'received':
      subject = `Order #${order.orderId} Received`;
      htmlBody = `
        <h1>Order Received</h1>
        <p>Hello ${order.firstName},</p>
        <p>We've received your order #${order.orderId}. Thank you for your purchase of ${order.product}!</p>
        <p>Total: $${order.totalCost}</p>
        <p>We'll process your order soon and notify you when it ships.</p>
      `;
      break;
    case 'processing':
      subject = `Order #${order.orderId} is Being Processed`;
      htmlBody = `
        <h1>Order Processing</h1>
        <p>Hello ${order.firstName},</p>
        <p>Your order #${order.orderId} for ${order.product} is now being processed.</p>
        <p>We'll notify you once it ships.</p>
      `;
      break;
    case 'shipped':
      subject = `Order #${order.orderId} Shipped`;
      htmlBody = `
        <h1>Order Shipped</h1>
        <p>Hello ${order.firstName},</p>
        <p>Great news! Your order #${order.orderId} for ${order.product} has been shipped and is on its way to:</p>
        <p>${order.address}, ${order.city}, ${order.state}, ${order.zipCode}</p>
        <p>Expected delivery time: 3-5 business days.</p>
      `;
      break;
    case 'delivered':
      subject = `Order #${order.orderId} Delivered`;
      htmlBody = `
        <h1>Order Delivered</h1>
        <p>Hello ${order.firstName},</p>
        <p>Your order #${order.orderId} for ${order.product} has been delivered!</p>
        <p>We hope you enjoy your purchase. If you have any questions, please contact our support team.</p>
      `;
      break;
    default:
      subject = `Update on Order #${order.orderId}`;
      htmlBody = `
        <h1>Order Status Update</h1>
        <p>Hello ${order.firstName},</p>
        <p>Your order #${order.orderId} status has been updated to: ${status}</p>
      `;
  }

  // SES parameters
  const params = {
    Source: 'thomas.dvorochkin@sjsu.edu', // Your verified SES email
    Destination: {
      ToAddresses: [
        // While in SES sandbox, this must also be a verified email
        // For testing, use your own email instead of customer email
        'thomas.dvorochkin@sjsu.edu'
        // In production, you would use: order.email
      ]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: htmlBody.replace(/<[^>]*>?/gm, ''), // Strip HTML for text version
          Charset: 'UTF-8'
        }
      }
    }
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log(`Email sent successfully, ID: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error('Error sending email with SES:', error);
    // Return error information but don't throw - we don't want to fail the order process
    return { 
      error: true, 
      message: error.message, 
      code: error.code
    };
  }
}

// Simplified validation rules for easier form submission
const orderValidationRules = [
  // Basic validation only - more permissive
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('zipCode').notEmpty().withMessage('Zip code is required'),
  
  // Payment validation with relaxed requirements
  body('payment').notEmpty().withMessage('Payment information is required'),
  body('payment.cardFirstName').notEmpty().withMessage('Card first name is required'),
  body('payment.cardLastName').notEmpty().withMessage('Card last name is required'),
  body('payment.cardNumber').notEmpty().withMessage('Card number is required'),
  body('payment.securityNumber').notEmpty().withMessage('Security code is required'),
  body('payment.expDate').notEmpty().withMessage('Expiration date is required'),
  
  // Product validation with relaxed requirements
  body('product').notEmpty().withMessage('Product name is required'),
  body('price').notEmpty().withMessage('Price is required'),
  body('shippingCost').notEmpty().withMessage('Shipping cost is required')
];

// Enhanced function to convert frontend format to backend format with detailed logging
function convertFrontendToBackendOrder(frontendOrder) {
  console.log('Converting order format. Original:', JSON.stringify(frontendOrder, null, 2));
  
  // Copy the order to avoid modifying the original
  const backendOrder = { ...frontendOrder };
  
  // Convert price and shippingCost to numbers if they're strings
  if (typeof backendOrder.price === 'string') {
    backendOrder.price = parseFloat(backendOrder.price) || 0;
  }
  
  if (typeof backendOrder.shippingCost === 'string') {
    backendOrder.shippingCost = parseFloat(backendOrder.shippingCost) || 0;
  }
  
  // Handle customerName from frontend if present
  if (backendOrder.customerName && !backendOrder.firstName) {
    // Try to extract first and last name from customerName
    const nameParts = backendOrder.customerName.trim().split(' ');
    if (nameParts.length >= 2) {
      backendOrder.firstName = nameParts[0];
      backendOrder.lastName = nameParts.slice(1).join(' ');
    } else {
      backendOrder.firstName = backendOrder.customerName;
      backendOrder.lastName = '';
    }
  }
  
  // Handle product details from frontend
  if (backendOrder.product && typeof backendOrder.product === 'object') {
    if (backendOrder.product.productName) {
      backendOrder.product = backendOrder.product.productName;
    }
    if (backendOrder.product.productPrice && !backendOrder.price) {
      backendOrder.price = parseFloat(backendOrder.product.productPrice) || 0;
    }
  }
  
  // Ensure payment object exists
  if (!backendOrder.payment) {
    backendOrder.payment = {};
  }
  
  // Handle expDate format conversion - very permissive handling
  if (backendOrder.payment) {
    // Handle expirationDate if used instead of expDate
    if (backendOrder.payment.expirationDate && !backendOrder.payment.expDate) {
      backendOrder.payment.expDate = backendOrder.payment.expirationDate;
    }
    
    // Try to convert any date format to MM/YY
    if (backendOrder.payment.expDate) {
      if (typeof backendOrder.payment.expDate === 'string') {
        if (backendOrder.payment.expDate.includes('-') || backendOrder.payment.expDate.includes('T')) {
          try {
            const date = new Date(backendOrder.payment.expDate);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString().slice(2);
            backendOrder.payment.expDate = `${month}/${year}`;
          } catch (error) {
            console.log('Date conversion error:', error);
            // If conversion fails, keep as is but ensure it's a string
            backendOrder.payment.expDate = String(backendOrder.payment.expDate);
          }
        }
      } else if (backendOrder.payment.expDate) {
        // Ensure expDate is a string
        backendOrder.payment.expDate = String(backendOrder.payment.expDate);
      }
    }
  }
  
  console.log('Converted order format. Result:', JSON.stringify(backendOrder, null, 2));
  return backendOrder;
}

// Async function to generate invoice
async function generateInvoice(orderId) {
  try {
    console.log(`Requesting invoice generation for order: ${orderId}`);
    const response = await axios.post(
      `${INVOICES_SERVICE_URL}/invoices/generate/${orderId}`,
      {}, // Empty body
      {
        timeout: 5000 // 5 second timeout to prevent hanging
      }
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
      { method: 'GET', path: '/orders/all', description: 'Get all orders' },
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
    invoicesService: INVOICES_SERVICE_URL,
    notificationsService: NOTIFICATIONS_SERVICE_URL,
    emailProvider: isDevelopment ? 'none (development mode)' : 'Amazon SES',
    timestamp: new Date().toISOString()
  });
});

// 2. Create a new order with enhanced logging and error handling
app.post('/orders', orderValidationRules, async (req, res) => {
  // Log the incoming request body
  console.log('Received order data:', JSON.stringify(req.body, null, 2));
  
  try {
    // Convert frontend format to backend format
    const convertedOrder = convertFrontendToBackendOrder(req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({ errors: errors.array() });
    }

    // Generate a unique order ID
    const orderId = uuidv4();
    
    // Calculate total cost (product price + shipping + tax)
    const productPrice = parseFloat(convertedOrder.price) || 0;
    const shippingCost = parseFloat(convertedOrder.shippingCost) || 0;
    const taxRate = 0.08; // 8% tax rate (can be made configurable)
    const taxAmount = productPrice * taxRate;
    const totalCost = productPrice + shippingCost + taxAmount;

    // Prepare order item with improved security (don't store full card details)
    const orderItem = {
      orderId,
      firstName: convertedOrder.firstName,
      lastName: convertedOrder.lastName,
      address: convertedOrder.address,
      city: convertedOrder.city,
      state: convertedOrder.state,
      country: convertedOrder.country,
      zipCode: convertedOrder.zipCode,
      email: convertedOrder.email,
      phoneNumber: convertedOrder.phoneNumber,
      payment: {
        cardFirstName: convertedOrder.payment.cardFirstName,
        cardLastName: convertedOrder.payment.cardLastName,
        billingAddress: convertedOrder.payment.billingAddress || convertedOrder.address,
        billingCity: convertedOrder.payment.billingCity || convertedOrder.city,
        billingState: convertedOrder.payment.billingState || convertedOrder.state,
        billingCountry: convertedOrder.payment.billingCountry || convertedOrder.country,
        billingZipCode: convertedOrder.payment.billingZipCode || convertedOrder.zipCode,
        cardNumber: convertedOrder.payment.cardNumber,
        // For security, only store last 4 digits of card number
        cardNumberLast4: convertedOrder.payment.cardNumber.slice(-4),
        // Don't store full security number, just indicate it was provided
        securityProvided: true,
        expDate: convertedOrder.payment.expDate
      },
      product: convertedOrder.product,
      price: productPrice,
      shippingCost: shippingCost,
      tax: taxAmount.toFixed(2),
      totalCost: totalCost.toFixed(2),
      status: convertedOrder.status || 'received',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Created order item:', JSON.stringify(orderItem, null, 2));

    // Store order using the appropriate storage method
    await orderStorage.create(orderItem);
    console.log('Order stored successfully with ID:', orderId);

    // Send order to Invoices service - don't block on this
    try {
      await axios.post(`${INVOICES_SERVICE_URL}/orders`, orderItem, { timeout: 3000 });
      console.log('Order sent to Invoices service successfully');
    } catch (error) {
      console.error('Error sending order to Invoices service:', error.message);
      // Don't fail the order creation if invoice service is down
    }

    // Send initial order notification (if not in development mode)
    let emailResult = { sent: false };
    try {
      // Send email notification
      const result = await sendOrderNotification(orderItem, 'received');
      emailResult = {
        sent: !result.error,
        messageId: result.MessageId || null,
        error: result.error ? result.message : null
      };
      console.log(`Order confirmation email result:`, emailResult);
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      emailResult = {
        sent: false,
        error: emailError.message
      };
    }

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
      notification: emailResult,
      invoice: invoiceResult
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// 3. Get all orders
app.get('/orders/all', async (req, res) => {
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
  // Log the incoming request body
  console.log('Received update order data:', JSON.stringify(req.body, null, 2));

  try {
    // Convert frontend format to backend format
    const convertedOrder = convertFrontendToBackendOrder(req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({ errors: errors.array() });
    }

    const orderId = req.params.orderId;
    
    // Check if order exists
    const existingOrder = await orderStorage.get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate updated total cost
    const productPrice = parseFloat(convertedOrder.price) || 0;
    const shippingCost = parseFloat(convertedOrder.shippingCost) || 0;
    const taxRate = 0.08; // 8% tax rate (can be made configurable)
    const taxAmount = productPrice * taxRate;
    const totalCost = productPrice + shippingCost + taxAmount;
    
    // Prepare updated order data
    const updatedOrderData = {
      firstName: convertedOrder.firstName,
      lastName: convertedOrder.lastName,
      address: convertedOrder.address,
      city: convertedOrder.city,
      state: convertedOrder.state,
      country: convertedOrder.country,
      zipCode: convertedOrder.zipCode,
      email: convertedOrder.email,
      phoneNumber: convertedOrder.phoneNumber,
      payment: {
        cardFirstName: convertedOrder.payment.cardFirstName,
        cardLastName: convertedOrder.payment.cardLastName,
        billingAddress: convertedOrder.payment.billingAddress || convertedOrder.address,
        billingCity: convertedOrder.payment.billingCity || convertedOrder.city,
        billingState: convertedOrder.payment.billingState || convertedOrder.state,
        billingCountry: convertedOrder.payment.billingCountry || convertedOrder.country,
        billingZipCode: convertedOrder.payment.billingZipCode || convertedOrder.zipCode,
        cardNumber: convertedOrder.payment.cardNumber,
        securityNumber: convertedOrder.payment.securityNumber,
        cardNumberLast4: convertedOrder.payment.cardNumber.slice(-4),
        securityProvided: true,
        expDate: convertedOrder.payment.expDate
      },
      product: convertedOrder.product,
      price: productPrice,
      shippingCost: shippingCost,
      tax: taxAmount.toFixed(2),
      totalCost: totalCost.toFixed(2),
      status: convertedOrder.status || existingOrder.status || 'received',
      updatedAt: new Date().toISOString()
    };

    // Update the order
    const updatedOrder = await orderStorage.update(orderId, updatedOrderData);

    // Notify of order update if status changed
    if (updatedOrderData.status && updatedOrderData.status !== existingOrder.status) {
      try {
        await sendOrderNotification(updatedOrder, updatedOrderData.status);
        console.log(`Update notification sent for order ${orderId} with status ${updatedOrderData.status}`);
      } catch (notifyError) {
        console.error('Failed to send update notification:', notifyError);
        // Don't fail the update if notification fails
      }
    }

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
    .withMessage('Valid status is required')
    .isIn(['received', 'processing', 'shipped', 'delivered', 'cancelled', 'on-hold', 'returned'])
    .withMessage('Invalid order status value')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const orderId = req.params.orderId;
    const newStatus = req.body.status;
    
    // Check if order exists
    const existingOrder = await orderStorage.get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update only the status
    const updatedOrder = await orderStorage.update(orderId, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    // Send notification email
    let emailResult = { sent: false };
    try {
      const result = await sendOrderNotification(updatedOrder, newStatus);
      emailResult = {
        sent: !result.error,
        messageId: result.MessageId || null,
        error: result.error ? result.message : null
      };
    } catch (emailError) {
      console.error('Failed to send order status update email:', emailError);
      emailResult = {
        sent: false,
        error: emailError.message
      };
    }

    res.status(200).json({
      message: 'Order status updated successfully',
      order: updatedOrder,
      notification: emailResult
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
    
    // Check if order exists first
    const existingOrder = await orderStorage.get(orderId);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Delete the order and get the deleted item
    const deletedOrder = await orderStorage.delete(orderId);
    
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
  try {
    const status = req.params.status;
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
      console.log(`Email Provider: ${isDevelopment ? 'None (development mode)' : 'Amazon SES'}`);
      console.log(`Configured to use Invoices service at: ${INVOICES_SERVICE_URL}`);
      console.log(`Configured to use Notifications service at: ${NOTIFICATIONS_SERVICE_URL}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Export for testing purposes
module.exports = { app, orderStorage, sendOrderNotification };