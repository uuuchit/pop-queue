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

# Set environment variables for production
ENV NODE_ENV=production
ENV DB_URL=mongodb://yourMongoDbUrl:27017
ENV REDIS_URL=redis://yourRedisUrl:6379
ENV MEMCACHED_URL=memcached://yourMemcachedUrl:11211
ENV POSTGRES_URL=postgres://yourPostgresUrl:5432

# Install monitoring and logging tools
RUN npm install pm2 -g
RUN npm install winston

# Set the entry point to start the application with monitoring
CMD ["pm2-runtime", "index.js"]
