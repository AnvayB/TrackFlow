const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Configure AWS clients
const dynamoDb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const ses = new AWS.SES({ region: 'us-east-2' });
const s3 = new AWS.S3({ region: 'us-east-2' });

// S3 bucket name
const S3_BUCKET = 'invoices-tf'; // replace with your bucket

let orders = []; // in-memory order storage
let currentId = 1;

app.post('/orders', (req, res) => {
  const newOrder = { id: currentId++, ...req.body };
  orders.push(newOrder);
  res.status(201).json(newOrder);
});

app.get('/orders', (req, res) => {
  res.json(orders);
});

app.get('/orders/search', (req, res) => {
  const nameQuery = req.query.name?.toLowerCase() || '';
  const result = orders.filter(order =>
    order.customerName.toLowerCase().includes(nameQuery)
  );
  res.json(result);
});

async function getOrderById(orderId) {
  const params = {
    TableName: 'Orders',
    Key: { OrderID: orderId }
  };
  const data = await dynamoDb.get(params).promise();
  return data.Item;
}

function createInvoicePDF(order, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Name: ${order.firstName} ${order.lastName}`);
    doc.text(`Email: ${order.email}`);
    doc.text(`Phone: ${order.phoneNumber}`);
    doc.text(`Address: ${order.homeAddress}, ${order.city}, ${order.state}, ${order.country}, ${order.zipCode}`);
    doc.moveDown();

    doc.text(`Card Holder: ${order.cardFirstName} ${order.cardLastName}`);
    doc.text(`Card: **** **** **** ${order.cardNumber.slice(-4)}`);
    doc.text(`Status: ${order.status || 'Received'}`);
    doc.moveDown();

    const totalCost = order.productPrice + order.shippingCost + order.tax;

    doc.text(`Order ID: ${order.OrderID}`);
    doc.text(`Product: ${order.product}`);
    doc.text(`Price: $${order.productPrice.toFixed(2)}`);
    doc.text(`Shipping: $${order.shippingCost.toFixed(2)}`);
    doc.text(`Tax: $${order.tax.toFixed(2)}`);
    doc.text(`Total: $${totalCost.toFixed(2)}`);

    doc.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function uploadPDFToS3(filePath, orderId) {
  const fileContent = fs.readFileSync(filePath);
  const s3Key = `invoices/invoice_${orderId}.pdf`;

  const uploadParams = {
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'application/pdf'
  };

  await s3.putObject(uploadParams).promise();

  return `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
}

async function sendEmailWithInvoice(order, base64PDF, orderId) {
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
}

async function generateAndSendInvoice(orderId) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const filePath = path.join(__dirname, `../exports/invoice_${orderId}.pdf`);
  await createInvoicePDF(order, filePath);

  // Upload to S3
  const s3Url = await uploadPDFToS3(filePath, orderId);

  // Send email
  const base64PDF = fs.readFileSync(filePath).toString('base64');
  await sendEmailWithInvoice(order, base64PDF, orderId);

  return {
    message: `Invoice sent to ${order.email} and uploaded to S3.`,
    s3Url
  };
}

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

module.exports = { generateAndSendInvoice };
