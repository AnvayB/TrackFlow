const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();
const PORT = 3002;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

let verifications = [];

app.post('/verify', upload.single('photo'), (req, res) => {
  const { orderId, gpsLat, gpsLong } = req.body;
  const photo = req.file ? req.file.filename : null;
  const record = {
    orderId,
    gpsLat,
    gpsLong,
    photo,
    timestamp: new Date()
  };
  verifications.push(record);
  res.status(201).json({ message: 'Delivery verified', record });
});

app.get('/verifications', (req, res) => {
  res.json(verifications);
});

app.listen(PORT, () => console.log(`Verification service running on port ${PORT}`));