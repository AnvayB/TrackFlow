import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import './micro.css'

interface Verification {
  orderId: string;
  gpsLat: string;
  gpsLong: string;
  photo?: string;
  timestamp?: string;
}

const VERIFY_API = 'http://localhost:3002/verify';
const VERIFY_LIST_API = 'http://localhost:3002/verifications';

export default function VerificationManager() {
  const [verification, setVerification] = useState<Verification>({ orderId: '', gpsLat: '', gpsLong: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    const res = await axios.get(VERIFY_LIST_API);
    setVerifications(res.data);
  };

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.append('orderId', verification.orderId);
    data.append('gpsLat', verification.gpsLat);
    data.append('gpsLong', verification.gpsLong);
    if (photo) data.append('photo', photo);
    await axios.post(VERIFY_API, data);
    setVerification({ orderId: '', gpsLat: '', gpsLong: '' });
    setPhoto(null);
    fetchVerifications();
  };

  return (
    <section>
      <h2>Delivery Verification</h2>
      <form onSubmit={handleVerify}>
        <input name="orderId" value={verification.orderId} onChange={(e) => setVerification({ ...verification, orderId: e.target.value })} placeholder="Order ID" required />
        <input name="gpsLat" value={verification.gpsLat} onChange={(e) => setVerification({ ...verification, gpsLat: e.target.value })} placeholder="GPS Latitude" required />
        <input name="gpsLong" value={verification.gpsLong} onChange={(e) => setVerification({ ...verification, gpsLong: e.target.value })} placeholder="GPS Longitude" required />
        <input type="file" onChange={(e) => setPhoto(e.target.files ? e.target.files[0] : null)} />
        <button type="submit">Submit Verification</button>
      </form>
      <ul>
        {verifications.map((v, i) => (
          <li key={i}>
            Order #{v.orderId} – Lat: {v.gpsLat}, Long: {v.gpsLong}, Time: {v.timestamp ? new Date(v.timestamp).toLocaleString() : 'N/A'} {v.photo && `(Photo: ${v.photo})`}
          </li>
        ))}
      </ul>
    </section>
  );
}
