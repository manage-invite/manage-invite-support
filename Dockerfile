FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --non-interactive

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN yarn build

# Command to run the application
CMD ["node", "index.js"]