# CareerBridge Server

Express TypeScript API server for CareerBridge application.

## Features

- **Express.js** with TypeScript
- **MongoDB** with Mongoose ODM
- **JWT Authentication** with role-based access control
- **Input Validation** with Joi
- **Error Handling** middleware
- **Rate Limiting** for API protection
- **Security** with Helmet and CORS
- **Logging** system
- **Environment Configuration**

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.ts   # MongoDB connection
│   └── index.ts      # App configuration
├── controller/       # Route controllers
│   ├── auth.controller.ts
│   └── user.controller.ts
├── middleware/       # Custom middleware
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── notFound.middleware.ts
│   └── validate.middleware.ts
├── model/           # Database models
│   ├── User.model.ts
│   └── Job.model.ts
├── route/           # API routes
│   ├── auth.routes.ts
│   └── user.routes.ts
├── utils/           # Utility functions
│   ├── logger.util.ts
│   ├── response.util.ts
│   └── validation.util.ts
├── app.ts           # Express app configuration
└── server.ts        # Server entry point
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Update `.env` file with your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/careerbridge
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

## Development

Start development server with hot reload:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/search` - Search users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)

### Companies
- `POST /api/companies/partner-request` - Submit partner request (Authenticated)
- `GET /api/companies/my-company` - Get employer's company (Authenticated)
- `GET /api/companies/partner-requests` - Get all partner requests (Admin only)
- `PATCH /api/companies/partner-requests/:id/approve` - Approve partner request (Admin only)
- `PATCH /api/companies/partner-requests/:id/reject` - Reject partner request (Admin only)
- `GET /api/public/companies` - Get all approved companies (Public)
- `GET /api/public/companies/:id` - Get company by ID (Public)

### Jobs (Employer Only)
- `POST /api/jobs` - Create new job post (checks plan limit)
- `GET /api/jobs/my-jobs` - Get employer's jobs
- `GET /api/jobs/my-stats` - Get job posting statistics
- `PUT /api/jobs/:id` - Update job post
- `DELETE /api/jobs/:id` - Delete job post

### Public Jobs
- `GET /api/public/posts` - Get all approved job posts (Public)
- `GET /api/public/posts/:id` - Get job post by ID (Public)
- `GET /api/public/posts/featured` - Get featured job posts (Public)
- `GET /api/public/posts/stats` - Get job statistics (Public)
- `GET /api/public/posts/suggestions` - Get search suggestions (Public)
- `GET /api/public/companies/:companyId/posts` - Get jobs by company (Public)

### Health Check
- `GET /api/health` - Server health status

### Documentation
For detailed API documentation, see:
- [Job API Documentation](./JOB_API_DOCUMENTATION.md) - Complete guide for job posting API
- [Test Job API](./test-job-api.http) - HTTP test file for job endpoints

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/careerbridge |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `CLIENT_URL` | Frontend URL | http://localhost:3000 |

## Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Joi** - Input validation
- **Bcrypt** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Compression** - Response compression
- **Rate Limiting** - API rate limiting

## License

MIT