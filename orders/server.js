/**
 * Orders Microservice - server.js
 * 
 * This microservice handles all order-related operations for the logistics tracking platform:
 * - Creating new orders in DynamoDB
 * - Retrieving orders with filtering capabilities
 * - Updating existing orders
 * - Deleting orders
 * - Order status management
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Configure AWS SDK
// Using IAM roles for EC2/EKS or IAM credentials for local development
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2',
  ...(process.env.IS_OFFLINE && {
    // For local development only - use local DynamoDB instance
    endpoint: 'http://localhost:8000',
    accessKeyId: 'AKIAUFFZ4X2DBTND2M62',  // For local DynamoDB
    secretAccessKey: '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'   // For local DynamoDB
  })
  // When deployed to AWS, the SDK will automatically use the IAM role assigned to the EC2/EKS instance
  // No need to provide explicit credentials, which is more secure
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Orders';

// Create DynamoDB table if it doesn't exist
const createOrdersTable = async () => {
  const tableParams = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'orderId', KeyType: 'HASH' } // Partition key
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
    await dynamodb.waitFor('tableExists', { TableName: TABLE_NAME }).promise();
    console.log(`Table ${TABLE_NAME} is now active`);
    
    return true;
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log(`Table ${TABLE_NAME} already exists`);
      return true;
    }
    console.error('Error creating DynamoDB table:', error);
    return false;
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

// Routes
// 1. Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
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

  // Store order in DynamoDB
  const params = {
    TableName: TABLE_NAME,
    Item: orderItem
  };

  try {
    await docClient.put(params).promise();
    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      totalCost: totalCost.toFixed(2)
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
});

// 3. Get all orders
app.get('/orders', async (req, res) => {
  const params = {
    TableName: TABLE_NAME
  };

  try {
    const data = await docClient.scan(params).promise();
    res.status(200).json(data.Items);
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// 4. Get a specific order by ID
app.get('/orders/:orderId', async (req, res) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      orderId: req.params.orderId
    }
  };

  try {
    const data = await docClient.get(params).promise();
    if (!data.Item) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json(data.Item);
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

  // First, check if the order exists
  const getParams = {
    TableName: TABLE_NAME,
    Key: {
      orderId: req.params.orderId
    }
  };

  try {
    const data = await docClient.get(getParams).promise();
    if (!data.Item) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate updated total cost
    const productPrice = parseFloat(req.body.price);
    const shippingCost = parseFloat(req.body.shippingCost);
    const taxRate = 0.08; // 8% tax rate (can be made configurable)
    const taxAmount = productPrice * taxRate;
    const totalCost = productPrice + shippingCost + taxAmount;

    // Prepare update parameters
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        orderId: req.params.orderId
      },
      UpdateExpression: "set firstName = :fn, lastName = :ln, address = :addr, city = :c, " +
        "state = :st, country = :cntry, zipCode = :zc, email = :em, phoneNumber = :pn, " +
        "payment = :pay, product = :prod, price = :pr, shippingCost = :sc, tax = :tx, " +
        "totalCost = :tc, updatedAt = :ua",
      ExpressionAttributeValues: {
        ":fn": req.body.firstName,
        ":ln": req.body.lastName,
        ":addr": req.body.address,
        ":c": req.body.city,
        ":st": req.body.state,
        ":cntry": req.body.country,
        ":zc": req.body.zipCode,
        ":em": req.body.email,
        ":pn": req.body.phoneNumber,
        ":pay": {
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
        ":prod": req.body.product,
        ":pr": productPrice,
        ":sc": shippingCost,
        ":tx": taxAmount.toFixed(2),
        ":tc": totalCost.toFixed(2),
        ":ua": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    };

    const updatedData = await docClient.update(updateParams).promise();
    res.status(200).json({
      message: 'Order updated successfully',
      order: updatedData.Attributes
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

  const params = {
    TableName: TABLE_NAME,
    Key: {
      orderId: req.params.orderId
    },
    UpdateExpression: "set #status = :s, updatedAt = :ua",
    ExpressionAttributeNames: {
      "#status": "status"  // Using ExpressionAttributeNames as 'status' is a reserved keyword
    },
    ExpressionAttributeValues: {
      ":s": req.body.status,
      ":ua": new Date().toISOString()
    },
    ReturnValues: "ALL_NEW"
  };

  try {
    const data = await docClient.update(params).promise();
    res.status(200).json({
      message: 'Order status updated successfully',
      order: data.Attributes
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error.code === 'ResourceNotFoundException') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Failed to update order status', details: error.message });
  }
});

// 7. Delete an order
app.delete('/orders/:orderId', async (req, res) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      orderId: req.params.orderId
    },
    ReturnValues: "ALL_OLD"
  };

  try {
    const data = await docClient.delete(params).promise();
    if (!data.Attributes) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json({
      message: 'Order deleted successfully',
      order: data.Attributes
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
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "#status = :statusValue",
    ExpressionAttributeNames: {
      "#status": "status"
    },
    ExpressionAttributeValues: {
      ":statusValue": status
    }
  };

  try {
    const data = await docClient.scan(params).promise();
    res.status(200).json(data.Items);
  } catch (error) {
    console.error('Error retrieving orders by status:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// 9. Search orders by customer email
app.get('/orders/customer/:email', async (req, res) => {
  const email = req.params.email;
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "email = :emailValue",
    ExpressionAttributeValues: {
      ":emailValue": email
    }
  };

  try {
    const data = await docClient.scan(params).promise();
    res.status(200).json(data.Items);
  } catch (error) {
    console.error('Error retrieving orders by email:', error);
    res.status(500).json({ error: 'Failed to retrieve orders', details: error.message });
  }
});

// Initialize server
const startServer = async () => {
  // Ensure the DynamoDB table exists
  const tableCreated = await createOrdersTable();
  
  if (tableCreated) {
    app.listen(PORT, () => {
      console.log(`Orders microservice running on port ${PORT}`);
    });
  } else {
    console.error('Failed to initialize database. Server not started.');
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing purposes
module.exports = app;