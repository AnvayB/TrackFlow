/**
 * Notifications Microservice - Enhanced SES Implementation
 * 
 * This service handles email notifications for order status updates
 * and other customer communications for the logistics tracking platform.
 */

require('dotenv').config();  // Load environment variables from .env file if available
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { promisify } = require('util');
const rateLimit = require('express-rate-limit'); // You'll need to install this package

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later'
});

// Apply rate limiting to notification endpoints
app.use('/notify', apiLimiter);
app.use('/test-notification', apiLimiter);

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Configure AWS SDK with explicit credentials for better troubleshooting
const AWS_REGION = process.env.AWS_REGION || 'us-east-2';
AWS.config.update({
  region: AWS_REGION,
  maxRetries: 3,  // Add retries for transient failures
  retryDelayOptions: {
    base: 300 // Base delay in ms between retries (will increase with exponential backoff)
  }
});

// Initialize SES only in production mode
let ses;
if (!isDevelopment) {
  ses = new AWS.SES({ 
    apiVersion: '2010-12-01',
    // Set explicit timeouts for better control
    httpOptions: {
      timeout: 5000,  // 5 second timeout
      connectTimeout: 5000
    }
  });
}

// SES verified email addresses - multiple options to increase delivery chances
const VERIFIED_SJSU_EMAIL = process.env.VERIFIED_SJSU_EMAIL || 'thomas.dvorochkin@sjsu.edu';
const VERIFIED_PERSONAL_EMAIL = process.env.VERIFIED_PERSONAL_EMAIL || 'thomas.dvorochkin@gmail.com';
const VERIFIED_EMAIL = process.env.VERIFIED_EMAIL || VERIFIED_SJSU_EMAIL; // Primary email to use

// Email templates for different status updates
const emailTemplates = {
  received: {
    subject: 'Order #{orderId} Received',
    title: 'Order Received',
    message: "We've received your order #{orderId}. Thank you for your purchase!"
  },
  processing: {
    subject: 'Order #{orderId} is Being Processed',
    title: 'Order Processing',
    message: "Your order #{orderId} is now being processed. We'll notify you once it ships."
  },
  shipped: {
    subject: 'Order #{orderId} Shipped',
    title: 'Order Shipped',
    message: "Great news! Your order #{orderId} has been shipped and is on its way to you. Expected delivery time: 3-5 business days."
  },
  delivered: {
    subject: 'Order #{orderId} Delivered',
    title: 'Order Delivered',
    message: "Your order #{orderId} has been delivered! We hope you enjoy your purchase."
  },
  cancelled: {
    subject: 'Order #{orderId} Cancelled',
    title: 'Order Cancelled',
    message: "Your order #{orderId} has been cancelled as requested. If you did not request this cancellation, please contact us immediately."
  },
  delayed: {
    subject: 'Order #{orderId} Delayed',
    title: 'Order Delayed',
    message: "We're sorry, but your order #{orderId} has been delayed. We're working to get it to you as soon as possible."
  }
};

// Helper function to replace placeholders in templates
function formatTemplate(template, data) {
  let result = template;
  for (const key in data) {
    result = result.replace(new RegExp(`#{${key}}`, 'g'), data[key]);
  }
  return result;
}

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Notifications microservice is running',
    environment: isDevelopment ? 'development' : 'production',
    emailProvider: isDevelopment ? 'none (development mode)' : 'Amazon SES',
    version: '1.2.0' // Version number helps track deployed changes
  });
});

// Health check
app.get('/health', async (req, res) => {
  let sesStatus = 'not checked';
  
  // Check SES status in production
  if (!isDevelopment && ses) {
    try {
      // Check SES quota/limits
      const quota = await ses.getSendQuota().promise();
      sesStatus = {
        healthy: true,
        quota: {
          max24HourSend: quota.Max24HourSend,
          maxSendRate: quota.MaxSendRate,
          sentLast24Hours: quota.SentLast24Hours,
          remainingToday: quota.Max24HourSend - quota.SentLast24Hours
        }
      };
    } catch (error) {
      sesStatus = {
        healthy: false,
        error: error.message,
        code: error.code
      };
    }
  }
  
  res.json({ 
    status: 'ok', 
    service: 'notifications',
    environment: isDevelopment ? 'development' : 'production',
    emailProvider: isDevelopment ? 'none (development mode)' : 'Amazon SES',
    sesStatus: isDevelopment ? 'disabled in development' : sesStatus,
    verifiedEmails: [VERIFIED_SJSU_EMAIL, VERIFIED_PERSONAL_EMAIL],
    region: AWS_REGION,
    timestamp: new Date().toISOString()
  });
});

//  notification function
async function sendNotification(orderId, customerEmail, status, customerName = '') {
  console.log(`📣 Sending notification for Order #${orderId} (${status}) to ${customerEmail}`);
  
  // Skip sending emails in development mode
  if (isDevelopment) {
    console.log(`[DEV] Would send email to ${customerEmail} about order ${orderId} status: ${status}`);
    return { messageId: 'dev-mode-no-email-sent', success: true };
  }
  
  // Get the template for this status
  const template = emailTemplates[status] || {
    subject: `Update on Order #${orderId}`,
    title: 'Order Status Update',
    message: `Your order #${orderId} status has been updated to: ${status}`
  };
  
  // Format the template with order data
  const subject = formatTemplate(template.subject, { orderId });
  const title = formatTemplate(template.title, { orderId });
  const message = formatTemplate(template.message, { orderId });
  
  // Build full HTML email with proper styling
  const htmlBody = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        h1 { color: #0066cc; font-size: 24px; margin-bottom: 20px; }
        .container { padding: 20px; max-width: 600px; margin: 0 auto; }
        .header { background-color: #f8f8f8; padding: 20px; text-align: center; border-bottom: 1px solid #ddd; }
        .content { padding: 20px; background-color: #ffffff; }
        .footer { margin-top: 30px; padding: 20px; font-size: 12px; color: #999; text-align: center; background-color: #f8f8f8; }
        p { margin-bottom: 15px; }
        .btn { background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>TrackFlow Logistics</h1>
      </div>
      <div class="container">
        <div class="content">
          <h1>${title}</h1>
          <p>Hello ${customerName || 'Valued Customer'},</p>
          <p>${message}</p>
          ${status === 'shipped' ? '<p><a href="#" class="btn">Track Package</a></p>' : ''}
          ${status === 'delivered' ? '<p>If you have any questions, please contact our support team.</p>' : ''}
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply.</p>
          <p>© ${new Date().getFullYear()} TrackFlow Logistics</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Create plain text version by stripping HTML tags
  const textBody = htmlBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

  // Use multiple recipient emails to increase delivery chances
  // In production with SES out of sandbox, you would use: customerEmail
  const recipientEmails = [VERIFIED_SJSU_EMAIL];
  
  // Add personal email as backup if it's different
  if (VERIFIED_PERSONAL_EMAIL !== VERIFIED_SJSU_EMAIL) {
    recipientEmails.push(VERIFIED_PERSONAL_EMAIL);
  }
  
  // Use different "From" name for better deliverability
  const fromName = "TrackFlow Logistics";
  const fromEmail = VERIFIED_EMAIL;
  const fromAddress = `${fromName} <${fromEmail}>`;

  // SES parameters with enhanced configuration
  const params = {
    Source: fromAddress,
    Destination: {
      ToAddresses: recipientEmails
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: textBody,
          Charset: 'UTF-8'
        }
      }
    },
    // Add reply-to for better deliverability
    ReplyToAddresses: [fromEmail],
    
    // Add headers for better tracking
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined
  };

  try {
    console.log(`Attempting to send email via SES to: ${recipientEmails.join(', ')}`);
    const result = await ses.sendEmail(params).promise();
    console.log(`✅ Email sent successfully, MessageID: ${result.MessageId}`);
    return {
      success: true,
      messageId: result.MessageId,
      recipients: recipientEmails
    };
  } catch (error) {
    console.error('❌ ERROR sending email with SES:', error);
    
    // Enhanced error logging
    console.error(`Error Type: ${error.name}`);
    if (error.code) console.error(`Error Code: ${error.code}`);
    if (error.statusCode) console.error(`Status Code: ${error.statusCode}`);
    if (error.message) console.error(`Error Message: ${error.message}`);
    if (error.requestId) console.error(`AWS Request ID: ${error.requestId}`);
    
    // Try to determine cause for better troubleshooting
    let errorType = 'unknown';
    let suggestion = 'Check AWS credentials and SES configuration.';
    
    if (error.code === 'MessageRejected') {
      errorType = 'message_rejected';
      suggestion = 'Email content may be triggering spam filters.';
    } else if (error.code === 'MailFromDomainNotVerified') {
      errorType = 'domain_not_verified';
      suggestion = 'Verify your sending domain in SES.';
    } else if (error.code === 'EmailAddressNotVerified') {
      errorType = 'email_not_verified';
      suggestion = `Verify ${fromEmail} in SES.`;
    } else if (error.code === 'Throttling') {
      errorType = 'throttling';
      suggestion = 'Sending rate exceeded. Implement exponential backoff.';
    } else if (error.code === 'AccessDenied' || error.code === 'AuthFailure') {
      errorType = 'auth_failure';
      suggestion = 'Check IAM permissions for SES access.';
    }
    
    console.log(`Error diagnosis: ${errorType}. ${suggestion}`);
    
    return {
      success: false,
      error: error.message,
      errorType: errorType,
      suggestion: suggestion
    };
  }
}

// /notify endpoint with better error handling and response
app.post('/notify', async (req, res) => {
  console.log('📩 Received notification request:', req.body);
  
  const { orderId, customerEmail, status, customerName } = req.body;
  
  // Validate required fields with detailed error messages
  if (!orderId) {
    return res.status(400).json({ 
      error: 'Missing required field: orderId',
      details: 'The order ID is required to send a notification'
    });
  }
  
  if (!customerEmail) {
    return res.status(400).json({ 
      error: 'Missing required field: customerEmail',
      details: 'A customer email address is required to send a notification'
    });
  }
  
  if (!status) {
    return res.status(400).json({ 
      error: 'Missing required field: status',
      details: 'An order status is required to send a notification'
    });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail)) {
    return res.status(400).json({
      error: 'Invalid email format',
      details: 'The provided email address is not in a valid format'
    });
  }

  // Validate status is one we recognize
  const validStatuses = ['received', 'processing', 'shipped', 'delivered', 'cancelled', 'delayed'];
  if (!validStatuses.includes(status) && !status.startsWith('custom-')) {
    console.warn(`Received notification request with non-standard status: ${status}`);
  }

  try {
    console.log(`🔄 Processing notification for Order #${orderId} (${status}) to ${customerEmail}`);
    
    // Send notification with enhanced error handling
    const result = await sendNotification(orderId, customerEmail, status, customerName);
    
    if (result.success) {
      console.log(`✅ Notification for Order #${orderId} processed successfully`);
      
      // Return successful response
      res.json({ 
        message: isDevelopment ? 'Notification logged (development mode)' : 'Notification sent successfully',
        success: true,
        details: {
          orderId,
          status,
          sentTo: result.recipients || [isDevelopment ? 'none (development mode)' : VERIFIED_EMAIL],
          customerEmail: customerEmail,
          messageId: result.messageId || 'none'
        }
      });
    } else {
      console.log(`❌ Notification for Order #${orderId} failed: ${result.error}`);
      
      // Still return 200 status since we processed the request
      // but indicate the email delivery failed
      res.json({
        message: 'Notification request processed but email delivery failed',
        success: false,
        details: {
          orderId,
          status,
          error: result.error,
          errorType: result.errorType,
          suggestion: result.suggestion
        }
      });
    }
  } catch (err) {
    console.error('❌ Error in notification processing:', err);
    res.status(500).json({ 
      error: 'Failed to process notification',
      details: err.message
    });
  }
});

// Test endpoint to verify SES connectivity
app.get('/test-ses', async (req, res) => {
  if (isDevelopment) {
    return res.json({
      message: 'SES testing not available in development mode',
      environment: 'development'
    });
  }
  
  try {
    // Get SES account sending statistics
    const sendingStats = await ses.getSendStatistics().promise();
    
    // Get SES sending limits
    const sendingLimits = await ses.getSendQuota().promise();
    
    res.json({
      message: 'SES connection test successful',
      region: AWS_REGION,
      sendingLimits: {
        max24HourSend: sendingLimits.Max24HourSend,
        maxSendRate: sendingLimits.MaxSendRate,
        sentLast24Hours: sendingLimits.SentLast24Hours,
        remainingSendCapacity: sendingLimits.Max24HourSend - sendingLimits.SentLast24Hours
      },
      sendingStats: {
        deliveryAttempts: sendingStats.SendDataPoints?.reduce((sum, point) => sum + point.DeliveryAttempts, 0) || 0,
        bounces: sendingStats.SendDataPoints?.reduce((sum, point) => sum + point.Bounces, 0) || 0,
        complaints: sendingStats.SendDataPoints?.reduce((sum, point) => sum + point.Complaints, 0) || 0,
        rejects: sendingStats.SendDataPoints?.reduce((sum, point) => sum + point.Rejects, 0) || 0
      },
      verifiedEmails: [VERIFIED_SJSU_EMAIL, VERIFIED_PERSONAL_EMAIL]
    });
  } catch (error) {
    console.error('Error testing SES connection:', error);
    res.status(500).json({
      message: 'SES connection test failed',
      error: error.message,
      code: error.code,
      region: AWS_REGION
    });
  }
});

// test notification endpoint
app.post('/test-notification', async (req, res) => {
  // Default test values
  const { 
    orderId = 'TEST-' + Math.floor(Math.random() * 10000), 
    customerEmail = VERIFIED_EMAIL, 
    status = 'received',
    customerName = 'Test Customer'
  } = req.body;
  
  console.log(`📧 Sending test notification: OrderID=${orderId}, Status=${status}`);
  
  try {
    // Send a test notification
    const result = await sendNotification(orderId, customerEmail, status, customerName);
    
    res.json({
      message: 'Test notification processed',
      success: result.success,
      development: isDevelopment,
      emailSent: !isDevelopment && result.success,
      details: result
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      message: 'Test notification failed',
      error: error.message,
      development: isDevelopment
    });
  }
});

// Custom notification endpoint for more complex messages
app.post('/custom-notification', async (req, res) => {
  const { 
    orderId, 
    customerEmail, 
    customerName, 
    subject, 
    title, 
    message
  } = req.body;
  
  // Validate required fields
  if (!orderId || !customerEmail || !subject || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'orderId, customerEmail, subject, and message are required'
    });
  }
  
  try {
    // Skip in development mode
    if (isDevelopment) {
      console.log(`[DEV] Would send custom email to ${customerEmail}:`, {
        subject,
        title,
        message
      });
      
      return res.json({
        success: true,
        message: 'Custom notification logged (development mode)',
        details: {
          orderId,
          customerEmail,
          subject
        }
      });
    }
    
    // Use different "From" name for better deliverability
    const fromName = "TrackFlow Logistics";
    const fromEmail = VERIFIED_EMAIL;
    const fromAddress = `${fromName} <${fromEmail}>`;
    
    // Generate HTML body
    const htmlBody = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          h1 { color: #0066cc; font-size: 24px; margin-bottom: 20px; }
          .container { padding: 20px; max-width: 600px; margin: 0 auto; }
          .header { background-color: #f8f8f8; padding: 20px; text-align: center; border-bottom: 1px solid #ddd; }
          .content { padding: 20px; background-color: #ffffff; }
          .footer { margin-top: 30px; padding: 20px; font-size: 12px; color: #999; text-align: center; background-color: #f8f8f8; }
          p { margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TrackFlow Logistics</h1>
        </div>
        <div class="container">
          <div class="content">
            <h1>${title || subject}</h1>
            <p>Hello ${customerName || 'Valued Customer'},</p>
            <p>${message}</p>
          </div>
          <div class="footer">
            <p>Order ID: ${orderId}</p>
            <p>This is an automated message, please do not reply.</p>
            <p>© ${new Date().getFullYear()} TrackFlow Logistics</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Create plain text version
    const textBody = htmlBody.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
    
    // Use verified email for testing
    const recipientEmails = [VERIFIED_SJSU_EMAIL];
    
    // SES parameters
    const params = {
      Source: fromAddress,
      Destination: {
        ToAddresses: recipientEmails
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      },
      ReplyToAddresses: [fromEmail]
    };
    
    // Send email
    const result = await ses.sendEmail(params).promise();
    
    res.json({
      success: true,
      message: 'Custom notification sent successfully',
      details: {
        messageId: result.MessageId,
        recipients: recipientEmails
      }
    });
  } catch (error) {
    console.error('Error sending custom notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send custom notification',
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Notifications service listening on port ${PORT} in ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  console.log(`Email Provider: ${isDevelopment ? 'None (development mode)' : 'Amazon SES'}`);
  if (!isDevelopment) {
    console.log(`Using SES verified email: ${VERIFIED_EMAIL}`);
    console.log(`AWS Region: ${AWS_REGION}`);
    console.log(`Note: In sandbox mode, emails will only be sent to verified addresses`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = { app, sendNotification };