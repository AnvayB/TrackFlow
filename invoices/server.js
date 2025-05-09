const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3003;

app.use(bodyParser.json());

app.post('/generate', (req, res) => {
  const { order_id, customer_name, customer_email, amount } = req.body;

  const fileName = `invoice_${order_id}.pdf`;
  const filePath = path.join(__dirname, fileName);

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(18).text(`Invoice for Order: ${order_id}`, 100, 100);
  doc.text(`Customer: ${customer_name}`, 100, 130);
  doc.text(`Email: ${customer_email}`, 100, 160);
  doc.text(`Amount Paid: $${amount}`, 100, 190);
  doc.text(`Date: ${new Date().toLocaleString()}`, 100, 220);

  doc.end();

  res.json({ message: 'Invoice created', path: fileName });
});

app.listen(PORT, () => {
  console.log(`Invoice service running on port ${PORT}`);
});
