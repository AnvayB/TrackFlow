# order-service/Dockerfile
FROM node:18

WORKDIR /app

COPY server.js ./
RUN npm install express

EXPOSE 3001

CMD ["node", "server.js"]
