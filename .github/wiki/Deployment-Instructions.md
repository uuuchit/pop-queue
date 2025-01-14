# Deployment Instructions

This page provides deployment instructions for the `pop-queue` library, including Docker deployment, Kubernetes deployment, and CI/CD pipeline setup.

## Docker Deployment

To deploy the `pop-queue` library using Docker, follow these steps:

1. Create a `Dockerfile` in the root directory of your project with the following content:

```Dockerfile
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
```

2. Build the Docker image:

```bash
docker build -t pop-queue .
```

3. Run the Docker container:

```bash
docker run -d -p 3000:3000 -p 50051:50051 --name pop-queue pop-queue
```

The application should now be running in a Docker container.

## Kubernetes Deployment

To deploy the `pop-queue` library using Kubernetes, follow these steps:

1. Create a `deployment.yaml` file in the root directory of your project with the following content:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pop-queue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pop-queue
  template:
    metadata:
      labels:
        app: pop-queue
    spec:
      containers:
      - name: pop-queue
        image: pop-queue:latest
        ports:
        - containerPort: 3000
        - containerPort: 50051
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_URL
          value: "mongodb://yourMongoDbUrl:27017"
        - name: REDIS_URL
          value: "redis://yourRedisUrl:6379"
        - name: MEMCACHED_URL
          value: "memcached://yourMemcachedUrl:11211"
        - name: POSTGRES_URL
          value: "postgres://yourPostgresUrl:5432"
```

2. Apply the deployment configuration:

```bash
kubectl apply -f deployment.yaml
```

3. Expose the deployment as a service:

```bash
kubectl expose deployment pop-queue --type=LoadBalancer --name=pop-queue-service
```

The application should now be running in a Kubernetes cluster.

## CI/CD Pipeline Setup

To set up a CI/CD pipeline for the `pop-queue` library, follow these steps:

1. Create a `.github/workflows/ci-cd-pipeline.yaml` file in the root directory of your project with the following content:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '14'

    - name: Install dependencies
      run: npm install

    - name: Run tests
      run: npm test

    - name: Build Docker image
      run: docker build -t pop-queue .

    - name: Log in to Docker Hub
      run: echo "${{ secrets.DOCKER_HUB_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_HUB_USERNAME }}" --password-stdin

    - name: Push Docker image
      run: docker push ${{ secrets.DOCKER_HUB_USERNAME }}/pop-queue:latest

  deploy:
    runs-on: ubuntu-latest
    needs: build

    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Set up kubectl
      uses: azure/setup-kubectl@v1
      with:
        version: 'latest'

    - name: Set up Kubeconfig
      run: echo "${{ secrets.KUBECONFIG }}" > $HOME/.kube/config

    - name: Deploy to Kubernetes
      run: kubectl apply -f deployment.yaml
```

2. Add the following secrets to your GitHub repository:

- `DOCKER_HUB_USERNAME`: Your Docker Hub username
- `DOCKER_HUB_PASSWORD`: Your Docker Hub password
- `KUBECONFIG`: Your Kubernetes configuration file content

The CI/CD pipeline should now be set up to build, test, and deploy the `pop-queue` library automatically.
