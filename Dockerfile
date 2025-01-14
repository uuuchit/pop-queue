# Use the official Node.js image as the base image
FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Expose ports for the REST API and gRPC
EXPOSE 3000
EXPOSE 50051

# Set the entry point to start the application
CMD ["node", "index.js"]
