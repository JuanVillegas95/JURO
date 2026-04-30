# Juro

Juro is a lightweight internal practice platform for Java and SQL challenges. The initial scaffold provides:

- a Spring Boot API backed by Postgres
- a React + Vite web app for browsing and authoring problems
- submission history storage per problem
- seeded sample problems for one Java prompt and one SQL prompt

## Stack

- `backend/`: Java 17, Spring Boot, Spring Data JPA, Flyway, Postgres
- `frontend/`: React, TypeScript, Vite
- `docker-compose.yml`: local Postgres database

## Current scope

This first milestone focuses on problem authoring and submission persistence. The automated execution engine for Java and SQL is intentionally left as the next backend milestone instead of being faked inside the monolith.

## Run locally

Start Postgres:

```bash
docker compose up -d
```

Run the backend:

```bash
cd backend
mvn spring-boot:run
```

Run the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The frontend proxies `/api` calls to `http://localhost:8080`.

## Default local configuration

Backend defaults:

- database URL: `jdbc:postgresql://localhost:5432/juro`
- database user: `juro`
- database password: `juro`
- API port: `8080`

You can override them with:

- `JDBC_DATABASE_URL`
- `JDBC_DATABASE_USERNAME`
- `JDBC_DATABASE_PASSWORD`
- `SERVER_PORT`
- `APP_CORS_ALLOWED_ORIGIN`

## Useful endpoints

- `GET /api/problems`
- `POST /api/problems`
- `GET /api/problems/{problemId}`
- `GET /api/problems/{problemId}/submissions`
- `POST /api/problems/{problemId}/submissions`

## Data model

`Problem`

- Java or SQL type
- difficulty, summary, description
- starter code, reference solution, evaluation notes
- one or more examples

`Submission`

- linked to a problem
- stores submitted language and source
- stores the evaluation status and summary

## Suggested next milestone

Implement an isolated judge pipeline:

- Java: compile and run submissions in a sandbox against structured test cases
- SQL: provision ephemeral schemas or transactions and compare result sets
- hidden tests, execution timeouts, and richer statuses
