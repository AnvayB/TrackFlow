const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

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



app.listen(PORT, () => {
  console.log(`Invoice server running at http://localhost:${PORT}`);
});

