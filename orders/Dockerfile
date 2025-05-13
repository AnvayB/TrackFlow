FROM node:18-alpine

WORKDIR /usr/src/app

# Install AWS CLI for potential IAM credential management (optional)
RUN apk add --no-cache python3 py3-pip aws-cli

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose application port
EXPOSE 3001

# Set environment variables - these can be overridden at runtime
ENV NODE_ENV=production
ENV AWS_REGION=us-west-2

# Run the application
CMD ["node", "server.js"]
