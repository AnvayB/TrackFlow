const request = require('supertest');
const app = require('./server');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    put: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    scan: jest.fn().mockReturnThis(),
    promise: jest.fn().mockResolvedValue({
      Item: {
        orderId: 'test-order-id',
        firstName: 'John',
        lastName: 'Doe',
        status: 'received'
      },
      Items: [
        {
          orderId: 'test-order-id-1',
          firstName: 'John',
          lastName: 'Doe',
          status: 'received'
        },
        {
          orderId: 'test-order-id-2',
          firstName: 'Jane',
          lastName: 'Smith',
          status: 'shipped'
        }
      ],
      Attributes: {
        orderId: 'test-order-id',
        firstName: 'John',
        lastName: 'Doe',
        status: 'received'
      }
    })
  };

  const mockDynamoDB = {
    createTable: jest.fn().mockReturnThis(),
    waitFor: jest.fn().mockReturnThis(),
    promise: jest.fn().mockResolvedValue({})
  };

  return {
    DynamoDB: jest.fn(() => mockDynamoDB),
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    config: {
      update: jest.fn()
    }
  };
});

// Sample valid order data for testing
const validOrderData = {
  firstName: 'John',
  lastName: 'Doe',
  address: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  country: 'USA',
  zipCode: '12345',
  email: 'john.doe@example.com',
  phoneNumber: '555-123-4567',
  payment: {
    cardFirstName: 'John',
    cardLastName: 'Doe',
    billingAddress: '123 Main St',
    billingCity: 'Anytown',
    billingState: 'CA',
    billingCountry: 'USA',
    billingZipCode: '12345',
    cardNumber: '4111111111111111',
    securityNumber: '123',
    expDate: '12/25'
  },
  product: 'Sample Product',
  price: 99.99,
  shippingCost: 10.00
};

describe('Orders API Endpoints', () => {
  // Test health check endpoint
  describe('GET /health', () => {
    it('should return 200 OK with healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'healthy');
    });
  });

  // Test creating an order
  describe('POST /orders', () => {
    it('should create a new order', async () => {
      const res = await request(app)
        .post('/orders')
        .send(validOrderData);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'Order created successfully');
      expect(res.body).toHaveProperty('orderId');
      expect(res.body).toHaveProperty('totalCost');
    });

    it('should return 400 with missing required fields', async () => {
      const invalidData = { ...validOrderData };
      delete invalidData.firstName;
      
      const res = await request(app)
        .post('/orders')
        .send(invalidData);
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  // Test getting all orders
  describe('GET /orders', () => {
    it('should return all orders', async () => {
      const res = await request(app).get('/orders');
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // Test getting a specific order
  describe('GET /orders/:orderId', () => {
    it('should return a specific order', async () => {
      const res = await request(app).get('/orders/test-order-id');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('orderId', 'test-order-id');
    });
  });

  // Test updating an order
  describe('PUT /orders/:orderId', () => {
    it('should update an order', async () => {
      const res = await request(app)
        .put('/orders/test-order-id')
        .send(validOrderData);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Order updated successfully');
      expect(res.body).toHaveProperty('order');
    });
  });

  // Test updating just the order status
  describe('PATCH /orders/:orderId/status', () => {
    it('should update only the order status', async () => {
      const res = await request(app)
        .patch('/orders/test-order-id/status')
        .send({ status: 'shipped' });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Order status updated successfully');
      expect(res.body).toHaveProperty('order');
    });

    it('should return 400 with invalid status', async () => {
      const res = await request(app)
        .patch('/orders/test-order-id/status')
        .send({ status: 'invalid-status' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  // Test deleting an order
  describe('DELETE /orders/:orderId', () => {
    it('should delete an order', async () => {
      const res = await request(app).delete('/orders/test-order-id');
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Order deleted successfully');
      expect(res.body).toHaveProperty('order');
    });
  });

  // Test filtering orders by status
  describe('GET /orders/status/:status', () => {
    it('should return orders with specified status', async () => {
      const res = await request(app).get('/orders/status/shipped');
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should return 400 with invalid status', async () => {
      const res = await request(app).get('/orders/status/invalid-status');
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid status parameter');
    });
  });
  
  // Test searching orders by customer email
  describe('GET /orders/customer/:email', () => {
    it('should return orders for a specific customer email', async () => {
      const res = await request(app).get('/orders/customer/john.doe@example.com');
      
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });
  });
});
