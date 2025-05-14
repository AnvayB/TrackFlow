/**
 * Invoices Microservice
 * 
 * This microservice handles invoice generation, PDF creation, S3 upload, and email notifications
 * Works in both development (in-memory) and production (AWS) modes
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Determine if we're in a development environment
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Configure AWS clients based on environment
let dynamoDbConfig = { region: 'us-east-1' };
let sesConfig = { region: 'us-east-1' };
let s3Config = { region: 'us-east-1' };

// For local development, use dummy credentials
if (isDevelopment) {
  console.log('Using in-memory order storage in development mode');
  
  // Set dummy AWS configs for development
  dynamoDbConfig = {
    region: 'localhost',
    endpoint: 'http://localhost:8000',
    accessKeyId: 'LOCAL_DUMMY_KEY',
    secretAccessKey: 'LOCAL_DUMMY_SECRET'
  };
  
  // Use the same dummy credentials for other AWS services
  sesConfig = dynamoDbConfig;
  s3Config = dynamoDbConfig;
}

const dynamoDb = new AWS.DynamoDB.DocumentClient(dynamoDbConfig);
const ses = new AWS.SES(sesConfig);
const s3 = new AWS.S3(s3Config);

// S3 bucket name
const S3_BUCKET = 'invoices-tf'; // Your S3 bucket name

// In-memory storage for orders in development mode
const inMemoryOrders = {};

// Ensure exports directory exists
const EXPORTS_DIR = path.join(__dirname, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) {
  console.log(`Creating exports directory: ${EXPORTS_DIR}`);
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Root route to provide API information
app.get('/invoices', (req, res) => {
  res.status(200).json({
    message: 'Invoices microservice is running',
    environment: isDevelopment ? 'development' : 'production',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check endpoint' },
      { method: 'POST', path: '/invoices/generate/:orderId', description: 'Generate invoice for an order' }
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    environment: isDevelopment ? 'development' : 'production',
    storage: isDevelopment ? 'in-memory' : 'AWS DynamoDB'
  });
});

// Get an order by ID - supports both in-memory and DynamoDB
async function getOrderById(orderId) {
  if (isDevelopment) {
    console.log(`Using in-memory storage to get order: ${orderId}`);
    
    // For development, check if this order came from the Orders service
    // If not in memory, create a mock order for testing
    if (!inMemoryOrders[orderId]) {
      console.log(`Order ${orderId} not found in memory, creating mock order`);
      inMemoryOrders[orderId] = {
        orderId: orderId,
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phoneNumber: "555-123-4567",
        address: "123 Test St",
        city: "Test City",
        state: "TS",
        country: "USA",
        zipCode: "12345",
        payment: {
          cardFirstName: "Test",
          cardLastName: "User",
          cardNumberLast4: "1111"
        },
        product: "Test Product",
        price: 99.99,
        shippingCost: 10.00,
        tax: 8.00,
        totalCost: 117.99,
        status: "received"
      };
    }
    
    return inMemoryOrders[orderId];
  }
  
  // Original DynamoDB code for production
  const params = {
    TableName: 'Orders',
    Key: { orderId: orderId }
  };

  try {
    const data = await dynamoDb.get(params).promise();
    return data.Item;
  } catch (error) {
    console.error('Error getting order:', error);
    throw error;
  }
}

// Store an order in memory (for development mode)
function storeOrderInMemory(order) {
  if (isDevelopment && order && order.orderId) {
    console.log(`Storing order in memory: ${order.orderId}`);
    inMemoryOrders[order.orderId] = order;
  }
}

// Create a PDF invoice
function createInvoicePDF(order, filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Creating PDF invoice for order: ${order.orderId}`);
      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`Name: ${order.firstName} ${order.lastName}`);
      doc.text(`Email: ${order.email}`);
      doc.text(`Phone: ${order.phoneNumber}`);
      doc.text(`Address: ${order.address}, ${order.city}, ${order.state}, ${order.country}, ${order.zipCode}`);
      doc.moveDown();

      doc.text(`Card Holder: ${order.payment.cardFirstName} ${order.payment.cardLastName}`);
      doc.text(`Card: **** **** **** ${order.payment.cardNumberLast4}`);
      doc.text(`Status: ${order.status || 'Received'}`);
      doc.moveDown();

      doc.text(`Order ID: ${order.orderId}`);
      doc.text(`Product: ${order.product}`);
      doc.text(`Price: $${parseFloat(order.price).toFixed(2)}`);
      doc.text(`Shipping: $${parseFloat(order.shippingCost).toFixed(2)}`);
      doc.text(`Tax: $${parseFloat(order.tax).toFixed(2)}`);
      doc.text(`Total: $${parseFloat(order.totalCost).toFixed(2)}`);

      doc.end();
      writeStream.on('finish', () => {
        console.log(`PDF creation complete: ${filePath}`);
        resolve();
      });
      writeStream.on('error', (err) => {
        console.error(`PDF creation error: ${err}`);
        reject(err);
      });
    } catch (error) {
      console.error(`Exception in PDF creation: ${error}`);
      reject(error);
    }
  });
}

// Upload PDF to S3 (or mock in development)
async function uploadPDFToS3(filePath, orderId) {
  if (isDevelopment) {
    console.log(`Development mode: Skipping S3 upload for ${filePath}`);
    return `local://${filePath}`;
  }
  
  try {
    console.log(`Uploading PDF to S3 for order: ${orderId}`);
    const fileContent = fs.readFileSync(filePath);
    const s3Key = `invoices/invoice_${orderId}.pdf`;

    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf'
    };

    await s3.putObject(uploadParams).promise();
    console.log(`S3 upload successful: ${s3Key}`);

    return `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// Send email with invoice (or mock in development)
async function sendEmailWithInvoice(order, filePath, orderId) {
  if (isDevelopment) {
    console.log(`Development mode: Skipping email send for order ${orderId}`);
    console.log(`Email would be sent to: ${order.email}`);
    return;
  }
  
  try {
    console.log(`Sending invoice email for order: ${orderId}`);
    // Read file as base64
    const base64PDF = fs.readFileSync(filePath).toString('base64');
    const boundary = "NextPart";

    const rawEmail = [
      `From: "Your Company" <your_verified_email@example.com>`,
      `To: ${order.email}`,
      `Subject: Your Invoice`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `Hello ${order.firstName},\n\nPlease find attached your invoice.`,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="invoice_${orderId}.pdf"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="invoice_${orderId}.pdf"`,
      ``,
      base64PDF,
      ``,
      `--${boundary}--`
    ].join('\n');

    await ses.sendRawEmail({ RawMessage: { Data: rawEmail } }).promise();
    console.log(`Email sent successfully to: ${order.email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Main function to generate and send an invoice
async function generateAndSendInvoice(orderId) {
  try {
    console.log(`Starting invoice generation for order: ${orderId}`);
    const order = await getOrderById(orderId);
    
    if (!order) {
      console.error(`Order not found: ${orderId}`);
      return {
        success: false,
        message: 'Order not found'
      };
    }

    console.log(`Retrieved order details for: ${orderId}`);
    
    // Store the order in memory if in development mode
    storeOrderInMemory(order);
    
    const filePath = path.join(EXPORTS_DIR, `invoice_${orderId}.pdf`);
    await createInvoicePDF(order, filePath);
    console.log(`PDF created at: ${filePath}`);

    // Upload to S3 (skipped in development)
    let s3Url;
    try {
      s3Url = await uploadPDFToS3(filePath, orderId);
      console.log(`PDF uploaded to: ${s3Url}`);
    } catch (error) {
      console.error('S3 upload failed:', error);
      s3Url = `local://${filePath}`;
    }

    // Send email (skipped in development)
    try {
      await sendEmailWithInvoice(order, filePath, orderId);
      console.log(`Email sent to: ${order.email}`);
    } catch (error) {
      console.error('Email sending failed:', error);
    }

    console.log(`Invoice generation completed for order: ${orderId}`);
    return {
      message: `Invoice generated for order ${orderId}`,
      success: true,
      filePath,
      s3Url,
      emailSent: !isDevelopment
    };
  } catch (error) {
    console.error(`Error generating invoice for order ${orderId}:`, error);
    return {
      message: `Failed to generate invoice: ${error.message}`,
      success: false
    };
  }
}

// Endpoint to generate invoice by order ID
app.post('/invoices/generate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`Received request to generate invoice for order: ${orderId}`);
    
    const result = await generateAndSendInvoice(orderId);
    
    if (result.success) {
      console.log(`Successfully generated invoice for order: ${orderId}`);
      res.status(200).json(result);
    } else {
      console.error(`Failed to generate invoice for order: ${orderId}`);
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in invoice generation endpoint:', error);
    res.status(500).json({ 
      message: 'Error generating invoice', 
      error: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Invoices microservice running on port ${PORT} in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  console.log(`Invoice PDFs will be stored in: ${EXPORTS_DIR}`);
});

module.exports = { generateAndSendInvoice, app };