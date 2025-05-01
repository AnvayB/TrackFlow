# verification-service/Dockerfile
FROM node:18

WORKDIR /app

COPY server.js ./
RUN npm install express multer

EXPOSE 3002

CMD ["node", "server.js"]
