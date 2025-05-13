// notifications/server.js

// require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notifications' });
});

// Stub function: replace this later with SES logic
async function sendNotification(orderId, customerEmail, status) {
  console.log(`📣 [STUB] Notify ${customerEmail}: Order #${orderId} is now '${status}'`);
}

// POST /notify — called by your order service
app.post('/notifications/notify', async (req, res) => {
  const { orderId, customerEmail, status } = req.body;
  if (!orderId || !customerEmail || !status) {
    return res
      .status(400)
      .json({ error: 'orderId, customerEmail and status are required' });
  }

  try {
    // Local stub
    await sendNotification(orderId, customerEmail, status);

    // In production you’d swap sendNotification with real SES send
    res.json({ message: 'Notification logged (local stub)' });
  } catch (err) {
    console.error('Error in sendNotification:', err);
    res.status(500).json({ error: 'Failed to process notification' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Notifications service (local stub) listening on port ${PORT}`);
});
