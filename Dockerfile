# StudyVault - Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

EXPOSE 5000

CMD ["node", "server/server.js"]
