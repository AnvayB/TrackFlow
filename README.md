# TrackFlow


<img width="1420" alt="Screenshot 2025-05-15 at 12 59 38 AM" src="https://github.com/user-attachments/assets/95e5617d-1cb6-4469-861c-f356100dd8c8" />

TrackFlow is a comprehensive logistics tracking platform that helps businesses manage orders, generate invoices, and track shipments efficiently.

## Features

- **Order Management**: Create, update, and delete orders with detailed customer information
- **Invoice Generation**: Automatically generate and email PDF invoices
- **Customer Management**: Store and manage customer information securely
- **Payment Processing**: Secure payment handling with credit card information protection
- **Multi-environment Support**: Works in both development and production environments

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Make (for using Makefile commands)
- AWS Account (for production deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/AnvayB/TrackFlow.git
cd trackflow
```

2. Install dependencies:
```bash
make install-all
```

## Running the Application

### Local Development
```bash
make start
```
This will start all services in development mode:
- Frontend (React)
- Orders Service (Port 3001)
- Invoices Service (Port 3003)
- Notifications Service (Port 4000)

### Production Deployment
```bash
make start-prod
```
This will start the application in production mode with AWS services.

## Stopping the Application

You can stop the application in two ways:
1. Press `Ctrl+C` in the terminal
2. Run the stop command:
```bash
make stop
```
### Production Deployment
```
 make stop-prod

 ```
 This will stop the application in production mode with AWS services.

## Environment Configuration

The application supports two environments:

### Development
- Uses in-memory storage
- No AWS credentials required
- Local services for testing

### Production
- Uses AWS DynamoDB for data storage
- AWS S3 for invoice storage
- AWS SES for email notifications
- Requires AWS credentials configuration

## API Documentation

### Orders Service (Port 3001)
- `GET /orders` - List all orders
- `POST /orders` - Create new order
- `GET /orders/:orderId` - Get specific order
- `PUT /orders/:orderId` - Update order
- `DELETE /orders/:orderId` - Delete order

### Invoices Service (Port 3003)
- `POST /invoices/generate/:orderId` - Generate invoice
- `GET /invoices` - Service status

## Collaborators
- [Thomas Dvorochkin](https://www.linkedin.com/in/thomasdvorochkin/)
- [Niranjan Rao](https://www.linkedin.com/in/niranjan-rao-cali/)
- [Victor Dumaslan](https://www.linkedin.com/in/victordumaslan/)
- [Akshit Tyagi](https://www.linkedin.com/in/akshit-tyagi-at/)
