# Firefly Healthcare Platform

A modern healthcare care coordination platform built with Next.js, TypeScript, and MongoDB. Features role-based access control, real-time communication, and comprehensive care management tools.

## Prerequisites

- Node.js 18+
- npm or yarn
- Database (MongoDB Local or Cloud)
- Authentication provider account

## Getting Started

### 1. Environment Setup

Copy the environment template and configure your settings:

```bash
cp .env.example .env.local
```

Configure the following environment variables:
- Authentication provider keys
- Database connection string
- Webhook configuration
- Any additional service configurations

### 2. Database Setup

Run the interactive database initialization script:

```bash
npx tsx scripts/initialize-database.ts
```

Choose between local or cloud database setup and follow the guided configuration.

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Schema

Generate and push the database schema:

```bash
npx prisma generate && npx prisma db push
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### 6. Initial Setup

1. Create your authentication provider account
2. Use the admin interface to sync your user account
3. Configure your role and family access as needed

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm run lint` - Run linting checks
- Database validation and health check scripts available

## Security Notes

- Never commit environment files with actual credentials
- Use provided setup scripts for secure configuration
- Follow authentication and authorization patterns established in the codebase
- Refer to internal documentation for detailed security guidelines

## Architecture

- **Frontend**: Next.js 14+ with TypeScript
- **Database**: MongoDB with Prisma ORM
- **Authentication**: Role-based access control (Admin/Provider/Recipient)
- **Real-time**: Server-sent events for live features
- **UI**: Modern responsive design with dark mode support

## Support

For development questions and setup assistance, refer to the internal development documentation or contact the development team.
