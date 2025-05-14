/**
 * Invoices Microservice - Fixed Version
 * 
 * This microservice handles invoice generation, PDF creation, S3 upload, and email notifications.
 * Stores invoices only in S3 (no DynamoDB for invoices)
 * Works in both development (in-memory) and production (AWS) modes.
 */

require('dotenv').config(); // Load environment variables from .env file if available
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(bodyParser.json({ limit: '5mb' })); // Increased limit for larger orders
app.use(cors());

// Determine if we're in a development environment
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// AWS Configuration 
const AWS_REGION = process.env.AWS_REGION || 'us-east-2';
const S3_BUCKET = process.env.S3_BUCKET || 'invoices-tf';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'thomas.dvorochkin@sjsu.edu';

// Configure AWS services with proper region
AWS.config.update({
  region: AWS_REGION,
  maxRetries: 3
});

// Initialize AWS services
let dynamoDb, ses, s3;

// In-memory storage for orders in development mode (no invoice storage)
const inMemoryOrders = {};
const localInvoiceFiles = {}; // Just track filenames locally - no database

// Ensure exports directory exists for PDF files
const EXPORTS_DIR = path.join(__dirname, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) {
  console.log(`Creating exports directory: ${EXPORTS_DIR}`);
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Database Tables Configuration (only Orders table needed)
const ORDERS_TABLE = 'Orders';

// Initialize services and ensure needed AWS resources
async function initializeServices() {
  if (isDevelopment) {
    console.log('Using in-memory storage in development mode');
    
    // For local development, use mock implementations
    dynamoDb = {
      get: (params) => ({ 
        promise: () => {
          if (params.TableName === ORDERS_TABLE) {
            const orderId = params.Key.orderId;
            return Promise.resolve({ Item: inMemoryOrders[orderId] || null });
          }
          return Promise.resolve({ Item: null });
        }
      }),
      put: (params) => ({ 
        promise: () => {
          if (params.TableName === ORDERS_TABLE) {
            inMemoryOrders[params.Item.orderId] = params.Item;
          }
          return Promise.resolve({});
        }
      })
    };
    
    // Mock SES in development
    ses = {
      sendRawEmail: () => ({ 
        promise: () => {
          console.log('[DEV] Email would be sent in production');
          return Promise.resolve({ MessageId: `mock-email-${Date.now()}` });
        }
      }),
      verifyEmailIdentity: () => ({
        promise: () => {
          console.log('[DEV] Email would be verified in production');
          return Promise.resolve({});
        }
      })
    };
    
    // Mock S3 in development
    s3 = {
      putObject: () => ({
        promise: () => {
          console.log('[DEV] File would be uploaded to S3 in production');
          return Promise.resolve({});
        }
      }),
      getSignedUrl: () => 'http://localhost:3003/mock-s3-url'
    };
    
    return true;
  } else {
    // Production AWS setup
    dynamoDb = new AWS.DynamoDB.DocumentClient();
    ses = new AWS.SES({ apiVersion: '2010-12-01' });
    s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    
    console.log(`AWS services configured for region: ${AWS_REGION}`);
    
    // Verify SES email identity if needed
    try {
      console.log(`Checking email identity: ${SENDER_EMAIL}`);
      // First check if the email is already verified
      const { Identities } = await ses.listIdentities({
        IdentityType: 'EmailAddress',
        MaxItems: 100
      }).promise();
      
      if (!Identities.includes(SENDER_EMAIL)) {
        console.log(`Email ${SENDER_EMAIL} not verified. Sending verification request...`);
        await ses.verifyEmailIdentity({ EmailAddress: SENDER_EMAIL }).promise();
        console.log(`Verification email sent to ${SENDER_EMAIL}. Please check your inbox and verify the email.`);
        console.warn('WARNING: Email sending will fail until you verify your email address in SES!');
      } else {
        console.log(`Email ${SENDER_EMAIL} is already verified.`);
      }
    } catch (error) {
      console.error('Error checking/verifying email identity:', error);
      console.warn('WARNING: Email sending may fail due to verification issues!');
      // Don't fail startup, just log the error
    }
    
    // Check if S3 bucket exists and is accessible
    try {
      await s3.headBucket({ Bucket: S3_BUCKET }).promise();
      console.log(`S3 bucket ${S3_BUCKET} exists and is accessible`);
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
        console.log(`S3 bucket ${S3_BUCKET} does not exist, attempting to create it...`);
        try {
          await s3.createBucket({
            Bucket: S3_BUCKET,
            CreateBucketConfiguration: {
              LocationConstraint: AWS_REGION
            }
          }).promise();
          console.log(`S3 bucket ${S3_BUCKET} created successfully`);
        } catch (createError) {
          console.error(`Failed to create S3 bucket: ${createError.message}`);
          return false;
        }
      } else {
        console.error(`Error accessing S3 bucket: ${error.message}`);
        return false;
      }
    }
    
    return true;
  }
}

// Helper to calculate a unique, secure filename 
function generateSecureFilename(orderId) {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `invoice_${orderId}_${timestamp}_${randomStr}.pdf`;
}

// Root route to provide API information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Invoices microservice is running',
    environment: isDevelopment ? 'development' : 'production',
    version: '1.3.0',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check endpoint' },
      { method: 'POST', path: '/invoices/generate/:orderId', description: 'Generate invoice for an order' },
      { method: 'POST', path: '/orders', description: 'Receive orders from the Orders service' }
    ]
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  let sesStatus = 'not checked';
  let s3Status = 'not checked';
  
  // Check service status in production
  if (!isDevelopment) {
    try {
      // Try to get SES sending status
      const sendingStatus = await ses.getSendQuota().promise();
      sesStatus = {
        healthy: true,
        sendingEnabled: true,
        quota: {
          max24HourSend: sendingStatus.Max24HourSend,
          maxSendRate: sendingStatus.MaxSendRate,
          sentLast24Hours: sendingStatus.SentLast24Hours
        }
      };
    } catch (error) {
      sesStatus = {
        healthy: false,
        error: error.message,
        code: error.code
      };
    }
    
    try {
      // Check S3 bucket
      await s3.headBucket({ Bucket: S3_BUCKET }).promise();
      s3Status = {
        healthy: true,
        bucket: S3_BUCKET
      };
    } catch (error) {
      s3Status = {
        healthy: false,
        error: error.message,
        code: error.code
      };
    }
  }
  
  res.status(200).json({
    status: 'healthy',
    environment: isDevelopment ? 'development' : 'production',
    storage: isDevelopment ? 'in-memory orders' : 'AWS DynamoDB (orders only)',
    pdfStorage: isDevelopment ? `local (${EXPORTS_DIR})` : `S3 (${S3_BUCKET})`,
    email: isDevelopment ? 'development mode (no emails sent)' : 'Amazon SES',
    emailStatus: sesStatus,
    s3Status: s3Status,
    region: AWS_REGION,
    timestamp: new Date().toISOString()
  });
});

// Get an order by ID - supports both in-memory and DynamoDB
async function getOrderById(orderId) {
  if (isDevelopment) {
    console.log(`Using in-memory storage to get order: ${orderId}`);
    
    // For development, check if this order exists in memory
    if (!inMemoryOrders[orderId]) {
      console.log(`Order ${orderId} not found in memory`);
      return null;
    }
    
    return inMemoryOrders[orderId];
  }
  
  // Production DynamoDB code
  const params = {
    TableName: ORDERS_TABLE,
    Key: { orderId: orderId }
  };

  try {
    const data = await dynamoDb.get(params).promise();
    return data.Item;
  } catch (error) {
    console.error('Error getting order from DynamoDB:', error);
    throw error;
  }
}

// Store an order in memory (for development mode)
function storeOrder(order) {
  if (!order || !order.orderId) {
    console.error('Invalid order data received');
    throw new Error('Invalid order data');
  }
  
  if (isDevelopment) {
    console.log(`Storing order in memory: ${order.orderId}`);
    // Store the complete order data
    inMemoryOrders[order.orderId] = {
      orderId: order.orderId,
      firstName: order.firstName || '',
      lastName: order.lastName || '',
      email: order.email || '',
      phoneNumber: order.phoneNumber || '',
      address: order.address || '',
      city: order.city || '',
      state: order.state || '',
      country: order.country || '',
      zipCode: order.zipCode || '',
      payment: {
        cardFirstName: order.payment?.cardFirstName || '',
        cardLastName: order.payment?.cardLastName || '',
        cardNumberLast4: order.payment?.cardNumberLast4 || '****',
        expDate: order.payment?.expDate || ''
      },
      product: order.product || '',
      price: parseFloat(order.price || 0).toFixed(2),
      shippingCost: parseFloat(order.shippingCost || 0).toFixed(2),
      tax: parseFloat(order.tax || 0).toFixed(2),
      totalCost: parseFloat(order.totalCost || 0).toFixed(2),
      status: order.status || 'received',
      createdAt: order.createdAt || new Date().toISOString()
    };
    
    return inMemoryOrders[order.orderId];
  } else {
    // In production, we don't need to store the order again,
    // as it should already be in the Orders table
    console.log(`Using existing order in Orders table: ${order.orderId}`);
    return order;
  }
}

// Create a simple, clean PDF invoice
function createInvoicePDF(order, filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Creating PDF invoice for order: ${order.orderId}`);
      
      // Validate and normalize order data
      const safeOrder = {
        orderId: order.orderId || 'Unknown',
        firstName: order.firstName || '',
        lastName: order.lastName || '',
        email: order.email || '',
        phoneNumber: order.phoneNumber || '',
        address: order.address || '',
        city: order.city || '',
        state: order.state || '',
        country: order.country || '',
        zipCode: order.zipCode || '',
        payment: {
          cardFirstName: order.payment?.cardFirstName || '',
          cardLastName: order.payment?.cardLastName || '',
          cardNumberLast4: order.payment?.cardNumberLast4 || '****',
          expDate: order.payment?.expDate || ''
        },
        product: order.product || 'Product',
        // Format numerical values with proper validation
        price: formatCurrency(order.price),
        shippingCost: formatCurrency(order.shippingCost),
        tax: formatCurrency(order.tax),
        totalCost: formatCurrency(order.totalCost),
        status: order.status || 'received',
        createdAt: order.createdAt || new Date().toISOString()
      };
      
      // Create a simple document with standard settings
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice for Order ${safeOrder.orderId}`,
          Author: 'TrackFlow Logistics',
          Subject: 'Invoice'
        }
      });
      
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
      
      // Define dimensions
      const pageWidth = doc.page.width;
      const leftMargin = 50;
      const rightMargin = pageWidth - 50;
      const contentWidth = pageWidth - 100;
      
      // HEADER - Company information
      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown(0.5);
      
      doc.fontSize(10).font('Helvetica').text('TrackFlow Logistics', { align: 'center' });
      doc.text('123 Logistics Way, San Jose, CA 95113, USA', { align: 'center' });
      doc.text('support@trackflow.com', { align: 'center' });
      
      // Add a simple line separator
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(leftMargin, doc.y)
        .lineTo(rightMargin, doc.y)
        .stroke();
      doc.moveDown(0.5);
      
      // INVOICE INFORMATION
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice #: INV-${safeOrder.orderId.substring(0, 8)}`, { continued: true });
      doc.text(`    Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      
      // BILL TO SECTION
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica')
        .text(`${safeOrder.firstName} ${safeOrder.lastName}`)
        .text(`${safeOrder.address}, ${safeOrder.city}, ${safeOrder.state} ${safeOrder.zipCode}`)
        .text(`${safeOrder.country}`)
        .text(`Email: ${safeOrder.email}`)
        .text(`Phone: ${safeOrder.phoneNumber}`);
      
      // ORDER DETAILS
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Order Details:');
      doc.fontSize(10).font('Helvetica')
        .text(`Order ID: ${safeOrder.orderId}`)
        .text(`Date: ${new Date(safeOrder.createdAt).toLocaleDateString()}`)
        .text(`Status: ${safeOrder.status}`);
      
      // ITEMS TABLE - Simple and clean
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Items:');
      
      // Draw table header
      doc.moveDown(0.5);
      const tableTop = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      
      // Define column positions
      const col1 = leftMargin;
      const col2 = leftMargin + 50;
      const col3 = rightMargin - 100;
      
      doc.text('Item', col1, tableTop);
      doc.text('Description', col2, tableTop);
      doc.text('Price', col3, tableTop, { align: 'right' });
      
      // Draw line under header
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(leftMargin, doc.y)
        .lineTo(rightMargin, doc.y)
        .stroke();
      doc.moveDown(0.5);
      
      // Add item row
      doc.fontSize(10).font('Helvetica');
      doc.text('1', col1, doc.y);
      doc.text(safeOrder.product, col2, doc.y - doc.currentLineHeight());
      doc.text(safeOrder.price, col3, doc.y - doc.currentLineHeight(), { align: 'right' });
      
      // Draw line after items
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(leftMargin, doc.y)
        .lineTo(rightMargin, doc.y)
        .stroke();
      
      // TOTALS SECTION - Clean and readable
      doc.moveDown(0.5);
      
      // Function to draw total rows
      function drawTotalRow(label, value, isBold = false) {
        const currentY = doc.y;
        
        if (isBold) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');
        
        doc.text(label, col3 - 100, currentY);
        doc.text(value, col3, currentY, { align: 'right' });
        doc.moveDown(0.3);
      }
      
      // Draw totals
      drawTotalRow('Subtotal:', safeOrder.price);
      drawTotalRow('Shipping:', safeOrder.shippingCost);
      drawTotalRow('Tax:', safeOrder.tax);
      
      // Add a final separator before total
      doc.moveDown(0.2);
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(col3 - 100, doc.y)
        .lineTo(rightMargin, doc.y)
        .stroke();
      doc.moveDown(0.5);
      
      // Draw total with bold
      drawTotalRow('Total:', safeOrder.totalCost, true);
      
      // PAYMENT INFORMATION 
      doc.moveDown(1);
      doc.strokeColor('#cccccc').lineWidth(1)
        .moveTo(leftMargin, doc.y)
        .lineTo(rightMargin, doc.y)
        .stroke();
      doc.moveDown(2);
      
    // Set a text location near the right side
doc.fontSize(10).font('Helvetica-Bold');
doc.text('Payment Information:', 350, doc.y, {
  width: 200,
  align: 'right'
});

// Card holder info
doc.fontSize(10).font('Helvetica');
doc.text(`Card Holder: ${safeOrder.payment.cardFirstName} ${safeOrder.payment.cardLastName}`, 350, doc.y, {
  width: 200,
  align: 'right'
});

// Card number with formatting
doc.text(`Card Number: **** \n**** **** ${safeOrder.payment.cardNumberLast4}`, 350, doc.y, {
  width: 155,
  align: 'right'
});
// Expiration date
doc.text(`Exp. Date: ${safeOrder.payment.expDate || 'N/A'}`, 350, doc.y, {
  width: 150,
  align: 'right'
});

// THANK YOU MESSAGE
doc.moveDown(1);
doc.fontSize(10).text('Thank you for your business!', {
  align: 'right'
});
      
      
      // Finalize PDF
      doc.end();
      
      writeStream.on('finish', () => {
        console.log(`PDF creation complete: ${filePath}`);
        resolve(filePath);
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

// Helper function to safely format currency values
function formatCurrency(value) {
  try {
    // Convert to number, handle any input type
    let num = 0;
    
    if (typeof value === 'string') {
      // Remove any non-numeric characters except decimal point
      value = value.replace(/[^0-9.]/g, '');
      num = parseFloat(value);
    } else if (typeof value === 'number') {
      num = value;
    }
    
    // Check if it's a valid number
    if (isNaN(num)) {
      console.warn(`Invalid currency value: ${value}, defaulting to $0.00`);
      return '$0.00';
    }
    
    // Prevent extremely large numbers that could break formatting
    if (num > 9999999999) {
      console.warn(`Currency value too large: ${num}, capping at 9,999,999,999`);
      num = 9999999999;
    }
    
    // Format the number with proper currency formatting
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  } catch (error) {
    console.error(`Error formatting currency: ${error}`);
    return '$0.00';
  }
}

// Helper function to safely format currency values
function formatCurrency(value) {
  try {
    // Convert to number, handle any input type
    let num = 0;
    
    if (typeof value === 'string') {
      // Remove any non-numeric characters except decimal point
      value = value.replace(/[^0-9.]/g, '');
      num = parseFloat(value);
    } else if (typeof value === 'number') {
      num = value;
    }
    
    // Check if it's a valid number
    if (isNaN(num)) {
      console.warn(`Invalid currency value: ${value}, defaulting to $0.00`);
      return '$0.00';
    }
    
    // Prevent extremely large numbers that could break formatting
    if (num > 9999999999) {
      console.warn(`Currency value too large: ${num}, capping at 9,999,999,999`);
      num = 9999999999;
    }
    
    // Format the number with proper currency formatting
    return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  } catch (error) {
    console.error(`Error formatting currency: ${error}`);
    return '$0.00';
  }
}

// Upload PDF to S3 (or mock in development)
async function uploadPDFToS3(filePath, filename) {
  if (isDevelopment) {
    console.log(`Development mode: Skipping S3 upload for ${filePath}`);
    // Track the local file
    localInvoiceFiles[filename] = filePath;
    return {
      url: `local://${filePath}`,
      key: filename
    };
  }
  
  try {
    console.log(`Uploading PDF to S3: ${filename}`);
    const fileContent = fs.readFileSync(filePath);
    const s3Key = `invoices/${filename}`;

    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="${filename}"`
    };

    await s3.putObject(uploadParams).promise();
    console.log(`S3 upload successful: ${s3Key}`);
    
    // Generate a pre-signed URL for temporary access
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Expires: 604800 // URL expires in 7 days
    });

    return {
      url: signedUrl,
      publicUrl: `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
      key: s3Key
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// Send email with invoice (or mock in development)
async function sendEmailWithInvoice(order, filePath, filename, invoiceId) {
  if (isDevelopment) {
    console.log(`Development mode: Skipping email send for order ${order.orderId}`);
    console.log(`Email would be sent to: ${order.email}`);
    return {
      sent: false,
      message: 'Email sending skipped in development mode'
    };
  }
  
  try {
    console.log(`Preparing to send invoice email for order: ${order.orderId}`);
    console.log(`Customer email: ${order.email}`);
    
    // Read file as base64
    const base64PDF = fs.readFileSync(filePath).toString('base64');
    const boundary = "NextPart_" + Date.now().toString(16);
    
    // Use plain email address for From field to avoid formatting issues
    const fromEmail = SENDER_EMAIL;
    
    // Always try to send to the actual customer email
    const toEmail = order.email;
    
    // Print debug info
    console.log(`Sending FROM: ${fromEmail}`);
    console.log(`Sending TO: ${toEmail}`);

    const rawEmail = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: Your Invoice for Order #${order.orderId}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      `<html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background-color: #f5f5f5; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Your Invoice</h2>
            </div>
            <div class="content">
              <p>Hello ${order.firstName},</p>
              <p>Thank you for your order! Your invoice is attached to this email as a PDF file.</p>
              <p><strong>Order ID:</strong> ${order.orderId}</p>
              <p><strong>Invoice ID:</strong> ${invoiceId}</p>
              <p><strong>Total Amount:</strong> $${order.totalCost}</p>
              <p>If you have any questions about your order or invoice, please contact our customer support.</p>
            </div>
            <div class="footer">
              <p>TrackFlow Logistics</p>
              <p>123 Logistics Way, San Jose, CA 95113</p>
            </div>
          </div>
        </body>
      </html>`,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${filename}"`,
      ``,
      base64PDF,
      ``,
      `--${boundary}--`
    ].join('\n');

    // IMPORTANT: Use direct parameters instead of creating the full raw email
    // This gives SES more control over formatting
    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: [toEmail]
      },
      Message: {
        Subject: {
          Data: `Your Invoice for Order #${order.orderId}`,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: `<html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; }
                  .container { max-width: 600px; margin: 0 auto; }
                  .header { background-color: #f5f5f5; padding: 20px; text-align: center; }
                  .content { padding: 20px; }
                  .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #777; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h2>Your Invoice</h2>
                  </div>
                  <div class="content">
                    <p>Hello ${order.firstName},</p>
                    <p>Thank you for your order! Your invoice is attached to this email as a PDF file.</p>
                    <p><strong>Order ID:</strong> ${order.orderId}</p>
                    <p><strong>Invoice ID:</strong> ${invoiceId}</p>
                    <p><strong>Total Amount:</strong> $${order.totalCost}</p>
                    <p>If you have any questions about your order or invoice, please contact our customer support.</p>
                  </div>
                  <div class="footer">
                    <p>TrackFlow Logistics</p>
                    <p>123 Logistics Way, San Jose, CA 95113</p>
                  </div>
                </div>
              </body>
            </html>`,
            Charset: 'UTF-8'
          },
          Text: {
            Data: `Hello ${order.firstName},
            
Thank you for your order! Your invoice is attached to this email as a PDF file.

Order ID: ${order.orderId}
Invoice ID: ${invoiceId}
Total Amount: $${order.totalCost}

If you have any questions about your order or invoice, please contact our customer support.

TrackFlow Logistics
123 Logistics Way, San Jose, CA 95113`,
            Charset: 'UTF-8'
          }
        }
      },
      RawMessage: { 
        Data: rawEmail 
      }
    };

    // Try sending with the raw message first
    // This allows attachment of the PDF
    try {
      console.log('Attempting to send email with raw message (including PDF attachment)');
      const result = await ses.sendRawEmail({ RawMessage: { Data: rawEmail } }).promise();
      console.log(`Email with attachment sent successfully to: ${toEmail} (MessageId: ${result.MessageId})`);
      
      return {
        sent: true,
        messageId: result.MessageId,
        recipient: toEmail,
        withAttachment: true
      };
    } catch (rawError) {
      console.error('Failed to send raw email with attachment:', rawError);
      
      if (rawError.code === 'MessageRejected' && 
          rawError.message.includes('not verified') && 
          !rawError.message.includes(fromEmail)) {
        
        // The recipient email is not verified (SES sandbox limitation)
        console.warn(`Recipient ${toEmail} is not verified in SES. In sandbox mode, you can only send to verified emails.`);
        
        // If we're in an environment where we want to send anyway (development/testing),
        // we could fall back to sending without attachment to your verified email
        // But let's just return the error for now
        return {
          sent: false,
          error: `Recipient ${toEmail} is not verified in SES. In sandbox mode, you can only send to verified emails.`,
          code: rawError.code,
          solution: "To fix: 1) Verify this recipient email in SES console, or 2) Request production access to exit sandbox mode"
        };
      }
      
      // For other errors, just return the error
      return {
        sent: false,
        error: rawError.message,
        code: rawError.code
      };
    }
  } catch (error) {
    console.error('Error in email preparation:', error);
    return {
      sent: false,
      error: error.message
    };
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
    
    // Generate a unique invoice ID
    const invoiceId = `INV-${uuidv4().substring(0, 8)}`;
    console.log(`Generated Invoice ID: ${invoiceId}`);
    
    // Generate a secure filename for the PDF
    const filename = generateSecureFilename(orderId);
    const filePath = path.join(EXPORTS_DIR, filename);
    
    // Create the PDF
    await createInvoicePDF(order, filePath);
    console.log(`PDF created at: ${filePath}`);

    // Upload to S3 (skipped in development)
    let s3Result;
    try {
      s3Result = await uploadPDFToS3(filePath, filename);
      console.log(`PDF uploaded: ${s3Result.url}`);
    } catch (error) {
      console.error('S3 upload failed:', error);
      s3Result = {
        url: `local://${filePath}`,
        key: filename
      };
    }

    // Send email (skipped in development)
    let emailResult;
    try {
      emailResult = await sendEmailWithInvoice(order, filePath, filename, invoiceId);
      console.log(`Email result:`, emailResult);
    } catch (error) {
      console.error('Email sending failed:', error);
      emailResult = {
        sent: false,
        error: error.message
      };
    }

    // In development mode, track local files for debugging
    if (isDevelopment) {
      localInvoiceFiles[invoiceId] = {
        filename,
        filePath,
        orderId,
        createdAt: new Date().toISOString()
      };
    }

    console.log(`Invoice generation completed for order: ${orderId}`);
    return {
      message: `Invoice generated for order ${orderId}`,
      success: true,
      invoiceId,
      orderId,
      amount: order.totalCost,
      pdfUrl: s3Result.url,
      emailSent: emailResult.sent,
      createdAt: new Date().toISOString()
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
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error in invoice generation endpoint:', error);
    res.status(500).json({ 
      message: 'Error generating invoice', 
      error: error.message 
    });
  }
});

// Add a route to receive orders from the Orders service
app.post('/orders', async (req, res) => {
  try {
    const order = req.body;
    if (!order || !order.orderId) {
      return res.status(400).json({ 
        error: 'Invalid order data',
        message: 'Order ID is required'
      });
    }
    
    storeOrder(order);
    
    res.status(200).json({ 
      message: 'Order received and stored successfully',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Error storing order:', error);
    res.status(500).json({ 
      error: 'Failed to store order',
      message: error.message
    });
  }
});

// Clean up local PDF files (development only helper)
app.get('/cleanup', (req, res) => {
  if (!isDevelopment) {
    return res.status(403).json({
      message: 'Cleanup endpoint only available in development mode'
    });
  }
  
  try {
    let filesRemoved = 0;
    // Read all files in the exports directory
    const files = fs.readdirSync(EXPORTS_DIR);
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        fs.unlinkSync(path.join(EXPORTS_DIR, file));
        filesRemoved++;
      }
    }
    
    res.status(200).json({
      message: `Cleaned up ${filesRemoved} PDF files`,
      exportDir: EXPORTS_DIR
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to clean up files',
      error: error.message
    });
  }
});

// Start the server after initialization
initializeServices().then((initialized) => {
  if (!initialized) {
    console.error('Failed to initialize services. Check the logs for details.');
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log(`Invoices microservice running on port ${PORT} in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    console.log(`Invoice PDFs will be stored in: ${EXPORTS_DIR}`);
    console.log(`In production, PDFs will be uploaded to S3 bucket: ${S3_BUCKET}`);
    console.log(`Sender email in production: ${SENDER_EMAIL}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = { generateAndSendInvoice, app };