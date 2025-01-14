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
