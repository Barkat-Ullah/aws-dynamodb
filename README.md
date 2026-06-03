# DynamoDB Express TypeScript

A small Express + TypeScript project using DynamoDB (dynamoose) and AWS SDKs. This repo provides a product and user modules, DynamoDB config, file uploader utilities, and minimal middleware for auth and error handling.

**Quick Start**

- Install dependencies:

```
npm install
```

- Run in development (auto-reload):

```
npm run dev
```

- Build and start:

```
npm run build
npm start
```

**Local DynamoDB (recommended for development)**

The repository includes a `command.txt` with helpful commands to run a local service (floci/localstack-like) and utilities. Example commands from `command.txt`:

```
# Run floci local endpoint
docker run --rm -p 4566:4566 floci/floci:latest

# Persist floci data
docker run --rm -p 4566:4566 -e FLOCI_STORAGE_MODE=persistent -v "$(pwd)/floci-data:/app/data" floci/floci:latest

# Admin dashboard for DynamoDB
npm install -g dynamodb-admin
DYNAMO_ENDPOINT=http://localhost:4566 dynamodb-admin
http://localhost:8001

# Generate a JWT secret
openssl rand -hex 64
```

**Project Structure (brief)**

- src/
  - app.ts — Express app and server entrypoint
  - config/dynamodb.ts — DynamoDB configuration
  - modules/ — Feature modules (`Product`, `User`) with controllers, services, models, routes
  - utils/ — helpers like `fileuploader`, `sendResponse`, etc.
  - middleware/ — `auth`, `validateRequest`, global error handler

**Environment**

Create a `.env` with values for AWS credentials or local endpoint when using floci/localstack, and a `JWT_SECRET` (use the `openssl rand` command above).

**Scripts**

See `package.json` for scripts — `dev`, `build`, and `start`.

**Notes**

- The project uses `dynamoose` and both AWS SDK v2 and v3 libraries.
- `ensureBucketExists()` is invoked at server start to prepare any required S3-like storage.

If you want, I can:

- Expand README with examples for API endpoints and environment variables
- Add a `.env.example` and Docker Compose for local DynamoDB
- Run basic lint or type checks

**API Examples**

All routes are mounted under `/api` (see `src/app.ts`). Available module prefixes:

- `/api/user` — user registration, login, and profile management
- `/api/products` — product CRUD and batch operations

Common endpoints (examples):

- Register a new user

```
POST /api/user/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "password123"
}
```

- Login

```
POST /api/user/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "password123"
}
```

- Get current user profile (protected)

```
GET /api/user/me
Authorization: Bearer <JWT>
```

- Create a product (protected, multipart image)

```
POST /api/products
Authorization: Bearer <JWT>
Content-Type: multipart/form-data

Form fields:
- title (string)
- price (number)
- image (file) — optional
```

- List products (public)

```
GET /api/products
```

Refer to the route files for the full list: [src/routes/index.ts](src/routes/index.ts#L1-L20), [src/modules/User/user.route.ts](src/modules/User/user.route.ts#L1-L80), and [src/modules/Product/product.route.ts](src/modules/Product/product.route.ts#L1-L80).

**Environment Variables**

Create a `.env` file or set environment variables. A sample `.env.example` is included in the repository.

Important variables used by the app:

- `PORT` — server port (default 3000)
- `JWT_SECRET` — secret for signing/verifying JWTs (generate with `openssl rand -hex 64`)
- `S3_BUCKET` — bucket name used by the file uploader (default `orbit-project-assets`)
- `S3_ENDPOINT` — S3 endpoint (use `http://localhost:4566` for local floci/localstack)
- `MAX_FILE_SIZE` — maximum upload size in MB (integer)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — credentials for local testing (defaults in code use `test`)
- `DYNAMO_ENDPOINT` — (optional) local DynamoDB endpoint (e.g. `http://localhost:4566`)

See the included `.env.example` for example values.

**Notes**

- The project uses `dynamoose` to interact with DynamoDB and both AWS SDK v2 and v3 in different places.
- On server start `ensureBucketExists()` is invoked to create the configured S3 bucket when running against a local S3-compatible endpoint.
