# pop-queue

## Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Integration Guidelines](#integration-guidelines)
5. [Examples](#examples)
6. [Scaling and Performance](#scaling-and-performance)
7. [Job Management UI](#job-management-ui)
8. [API Endpoints](#api-endpoints)
9. [gRPC Endpoints](#grpc-endpoints)
10. [Configuration](#configuration)
11. [Error Handling](#error-handling)
12. [Deployment Instructions](#deployment-instructions)
13. [Contributing](#contributing)
14. [License](#license)
15. [Core Features](#core-features)
16. [New Features](#new-features)
17. [Docker Instructions](#docker-instructions)
18. [Sync Wiki to GitHub Wiki Repository](#sync-wiki-to-github-wiki-repository)
19. [Wiki Home](https://github.com/uuuchit/pop-queue/wiki/Home)

## Overview

`pop-queue` is a library for managing job queues using MongoDB, Redis, Memcached, and PostgreSQL. It allows you to define, enqueue, and process jobs with ease. The library is designed to handle high concurrency and large-scale systems.

For detailed documentation, please visit the [GitHub wiki](https://github.com/uuuchit/pop-queue/wiki).

## Installation

To install the library, use npm:

```bash
npm install pop-queue
```

## Usage

To use the library, follow these steps:

1. Import the library in your project.
2. Create a queue by instantiating the `PopQueue` class with the required parameters.
3. Define jobs using the `define` method.
4. Enqueue jobs using the `now` method.
5. Start the queue using the `start` method.

For detailed usage instructions, please visit the [Usage](https://github.com/uuuchit/pop-queue/wiki/Usage) page in the GitHub wiki.

## Integration Guidelines

To integrate `pop-queue` into your project, follow these steps:

1. Install the library using npm.
2. Import the library in your project.
3. Create a queue by instantiating the `PopQueue` class with the required parameters.
4. Define jobs using the `define` method.
5. Enqueue jobs using the `now` method.
6. Start the queue using the `start` method.

For detailed integration guidelines, please visit the [Integration Guidelines](https://github.com/uuuchit/pop-queue/wiki/Integration-Guidelines) page in the GitHub wiki.

## Examples

For examples of using the library, including basic usage, handling failures, using Memcached, using PostgreSQL, job rate limiting and concurrency control, job retries and backoff strategies, job progress tracking and completion callbacks, job data schema validation, job dependencies and flow control, built-in metrics and monitoring tools, job events and listeners, image resizing and processing job queue, and sending bulk emails to users, please visit the [Examples](https://github.com/uuuchit/pop-queue/wiki/Examples) page in the GitHub wiki.

## Video Transcoding

To create a video transcoding job queue, use the `ffmpeg` library:

```javascript
const ffmpeg = require('fluent-ffmpeg');

queue.define('videoTranscodingJob', async (job) => {
  console.log('Processing video transcoding job:', job);
  const { inputPath, outputPath, format } = job.data;
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .format(format)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return true;
});

queue.now({ inputPath: 'input.mp4', outputPath: 'output.mp4', format: 'mp4' }, 'videoTranscodingJob', 'videoTranscodingJobIdentifier', Date.now());

queue.start();
```

## Image Processing

To create an image resizing and processing job queue, use the `sharp` library:

```javascript
const sharp = require('sharp');

queue.define('imageResizingJob', async (job) => {
  console.log('Processing image resizing job:', job);
  const { inputPath, outputPath, width, height } = job.data;
  await sharp(inputPath)
    .resize(width, height)
    .toFile(outputPath);
  return true;
});

queue.now({ inputPath: 'input.jpg', outputPath: 'output.jpg', width: 800, height: 600 }, 'imageResizingJob', 'imageResizingJobIdentifier', Date.now());

queue.start();
```

## Email Sending

To create a job queue for sending bulk emails to users, use the `nodemailer` library:

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-email-password'
  }
});

queue.define('bulkEmailJob', async (job) => {
  console.log('Processing bulk email job:', job);
  const { to, subject, text } = job.data;
  await transporter.sendMail({
    from: 'your-email@gmail.com',
    to,
    subject,
    text
  });
  return true;
});

queue.now({ to: 'user@example.com', subject: 'Hello', text: 'This is a bulk email.' }, 'bulkEmailJob', 'bulkEmailJobIdentifier', Date.now());

queue.start();
```

## Scaling and Performance

For scaling and performance guidelines, including MongoDB sharding and Redis clustering, please visit the [Scaling and Performance](https://github.com/uuuchit/pop-queue/wiki/Scaling-and-Performance) page in the GitHub wiki.

## Job Management UI

For documentation on the job management UI, including accessing the UI, UI structure, and UI files, please visit the [Job Management UI](https://github.com/uuuchit/pop-queue/wiki/Job-Management-UI) page in the GitHub wiki.

## API Endpoints

For documentation on API endpoints, including getting job details and requeuing a job, please visit the [API Endpoints](https://github.com/uuuchit/pop-queue/wiki/API-Endpoints) page in the GitHub wiki.

## gRPC Endpoints

For documentation on gRPC endpoints, including getting job details and requeuing a job, please visit the [gRPC Endpoints](https://github.com/uuuchit/pop-queue/wiki/gRPC-Endpoints) page in the GitHub wiki.

## Configuration

For documentation on configuration and environment variables, please visit the [Configuration](https://github.com/uuuchit/pop-queue/wiki/Configuration) page in the GitHub wiki.

## Error Handling

For documentation on error handling in API endpoints and queue operations, please visit the [Error Handling](https://github.com/uuuchit/pop-queue/wiki/Error-Handling) page in the GitHub wiki.

## Deployment Instructions

For deployment instructions, including Docker deployment, Kubernetes deployment, and CI/CD pipeline setup, please visit the [Deployment Instructions](https://github.com/uuuchit/pop-queue/wiki/Deployment-Instructions) page in the GitHub wiki.

## Contributing

For contributing guidelines, please visit the [Contributing](https://github.com/uuuchit/pop-queue/wiki/Contributing) page in the GitHub wiki.

## License

For license information, please visit the [License](https://github.com/uuuchit/pop-queue/wiki/License) page in the GitHub wiki.

## Core Features

For documentation on core features, including task scheduling, concurrency control, persistence, distributed execution, and fault tolerance, please visit the [Core Features](https://github.com/uuuchit/pop-queue/wiki/Core-Features) page in the GitHub wiki.

## New Features

For documentation on new features, including job prioritization and delayed jobs, rate limiting and concurrency control, job retries and backoff strategies, job events and listeners, job progress tracking and completion callbacks, job data schema validation, job dependencies and flow control, and built-in metrics and monitoring tools, please visit the [New Features](https://github.com/uuuchit/pop-queue/wiki/New-Features) page in the GitHub wiki.

## Docker Instructions

For Docker instructions, including building the Docker image and running the Docker container, please visit the [Docker Instructions](https://github.com/uuuchit/pop-queue/wiki/Docker-Instructions) page in the GitHub wiki.

## Sync Wiki to GitHub Wiki Repository

A new GitHub Actions workflow has been added to sync the contents of the `.github/wiki` directory to the GitHub Wiki repository on push. This workflow ensures that any changes made to the wiki files in the `.github/wiki` directory are automatically reflected in the GitHub Wiki repository.

### Purpose

The purpose of this workflow is to automate the process of syncing the wiki files to the GitHub Wiki repository, ensuring that the documentation is always up-to-date.

### How it Works

The workflow triggers on push to the `.github/wiki` directory. It includes the following steps:
1. Checkout the main repository.
2. Clone the GitHub Wiki repository.
3. Copy files from the `.github/wiki` directory to the wiki repository.
4. Commit and push changes to the GitHub Wiki repository.

### Instructions

To trigger the workflow, simply push changes to the `.github/wiki` directory. The workflow will automatically run and sync the changes to the GitHub Wiki repository.

## Installation from npm

To install the package from npm, use the following command:

```bash
npm install pop-queue
```

## Usage after Installation

After installing the package from npm, you can use it in your project as follows:

```javascript
const { PopQueue } = require('pop-queue');

const queue = new PopQueue('mongodb://localhost:27017', 'redis://localhost:6379', 'myDatabase', 'myCollection', 3);

queue.define('myJob', async (job) => {
  console.log('Processing job:', job);
  // Perform job processing logic here
  return true;
});

queue.now({ data: 'jobData' }, 'myJob', 'jobIdentifier', Date.now());

queue.start();
```

## Contributing to the Package

Thank you for considering contributing to the `pop-queue` project! We welcome contributions from the community to help improve and enhance the library. Please take a moment to review the following guidelines before getting started.

### How to Contribute

1. **Fork the Repository**: Start by forking the `pop-queue` repository to your GitHub account.

2. **Clone the Repository**: Clone the forked repository to your local machine.

   ```bash
   git clone https://github.com/your-username/pop-queue.git
   cd pop-queue
   ```

3. **Create a Branch**: Create a new branch for your contribution. Use a descriptive name for the branch to indicate the purpose of your changes.

   ```bash
   git checkout -b my-feature-branch
   ```

4. **Make Changes**: Make your changes to the codebase. Ensure that your changes adhere to the project's coding standards and guidelines.

5. **Write Tests**: If applicable, write tests to cover your changes. Ensure that all existing tests pass.

6. **Commit Changes**: Commit your changes with a descriptive commit message.

   ```bash
   git add .
   git commit -m "Add feature X"
   ```

7. **Push Changes**: Push your changes to your forked repository.

   ```bash
   git push origin my-feature-branch
   ```

8. **Create a Pull Request**: Open a pull request (PR) on the original `pop-queue` repository. Provide a clear and concise description of your changes and the problem they solve.

### Code of Conduct

We expect all contributors to adhere to the project's Code of Conduct. Please read and follow the [Code of Conduct](https://github.com/uuuchit/pop-queue/blob/main/CODE_OF_CONDUCT.md) to ensure a positive and inclusive environment for everyone.

### Reporting Issues

If you encounter any issues or bugs while using `pop-queue`, please report them by opening an issue on the GitHub repository. Provide as much detail as possible to help us understand and resolve the issue.

### Feature Requests

We welcome feature requests and suggestions for improvements. If you have an idea for a new feature, please open an issue on the GitHub repository and provide a detailed description of the feature and its benefits.

### Contact

If you have any questions or need further assistance, feel free to reach out to the project maintainers by opening an issue 

Thank you for your contributions and support!
