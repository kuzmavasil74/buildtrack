# BuildTrack 🏗️

Full-stack construction site daily tracking application.

## Live Demo

- **Frontend:** https://buildtrack-frontend-ten.vercel.app
- **Backend API:** https://buildtrack-api-x1xl.onrender.com

## Tech Stack

**Backend:**

- Node.js + Express
- PostgreSQL (users, authentication) — raw SQL via `pg`
- MongoDB + Mongoose (daily records) — document model
- JWT authentication + bcrypt
- CORS configured for production

**Frontend:**

- React + Vite
- React Router DOM
- Axios
- Tailwind CSS

**Infrastructure:**

- Backend deployed on Render
- Frontend deployed on Vercel
- PostgreSQL on Render
- MongoDB on Atlas
- Docker (local development)

## Features

- User registration and login with JWT
- Create daily construction site records
- View records history
- Responsive design

## API Endpoints

| Method | Endpoint       | Description         | Auth |
| ------ | -------------- | ------------------- | ---- |
| POST   | /auth/register | Register new user   | No   |
| POST   | /auth/login    | Login user          | No   |
| POST   | /records       | Create daily record | Yes  |
| GET    | /records       | Get user records    | Yes  |

## Local Development

### Prerequisites

- Node.js 20+
- Docker

### Setup

1. Clone the repository:

```bash
git clone https://github.com/kuzmavasil74/buildtrack.git
cd buildtrack
```

2. Install dependencies:

```bash
npm install
```

3. Start databases with Docker:

```bash
docker-compose up -d
```

4. Copy environment variables:

```bash
cp .env.example .env
```

5. Run the server:

```bash
node src/server.js
```

## Environment Variables
