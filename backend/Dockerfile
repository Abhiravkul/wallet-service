# 1. Use a smaller, faster image
FROM node:18-alpine

WORKDIR /app

# 2. Install dependencies first (better caching)
COPY package*.json ./
RUN npm install

# 3. Copy source code
COPY . .

# 4. Clean and Build (Ensures 'dist' is fresh and uses current ENV vars)
RUN rm -rf dist && npm run build

# 5. Run the compiled JS directly for better performance
CMD ["node", "dist/server.js"]