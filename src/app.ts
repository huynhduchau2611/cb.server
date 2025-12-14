import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Import routes
import routes from '@/route';

// Import middleware
import { errorHandler } from '@/middleware/error.middleware';
import { notFoundHandler } from '@/middleware/notFound.middleware';

// Load environment variables
dotenv.config();

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // CORS configuration (must be before helmet)
    this.app.use(cors({
      origin: function (origin, callback) {
        console.log('CORS origin check:', origin);
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          console.log('No origin provided, allowing request');
          return callback(null, true);
        }
        
        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:4000',
          'http://127.0.0.1:4000',
          process.env.CLIENT_URL || 'http://localhost:3000',
          // Allow ngrok URLs (for webhook testing)
          ...(process.env.NGROK_URL ? [process.env.NGROK_URL] : [])
        ];
        
        // Allow all ngrok.io and ngrok-free.app domains
        if (origin && (origin.includes('.ngrok.io') || origin.includes('.ngrok-free.app'))) {
          console.log('Ngrok origin allowed:', origin);
          return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          console.log('Origin allowed:', origin);
          callback(null, true);
        } else {
          console.log('CORS blocked origin:', origin, 'Allowed origins:', allowedOrigins);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
      ],
      exposedHeaders: ['Authorization'],
      optionsSuccessStatus: 200,
      preflightContinue: false
    }));

    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // Rate limiting - Very permissive in development
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'production' ? 200 : 10000, // Very high limit for development
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      skip: (req) => {
        // Skip rate limiting for health checks in development
        if (process.env.NODE_ENV === 'development') {
          return req.path === '/api/health';
        }
        return false;
      },
    });
    this.app.use(limiter);

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(morgan('combined'));
    
    // Custom request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log('=== INCOMING REQUEST ===');
      console.log('Method:', req.method);
      console.log('URL:', req.url);
      console.log('Origin:', req.headers.origin);
      console.log('User-Agent:', req.headers['user-agent']);
      console.log('Content-Type:', req.headers['content-type']);
      console.log('Body:', req.body);
      console.log('=== REQUEST END ===');
      next();
    });

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files (uploads)
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    
    // Response logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      res.send = function(data) {
        console.log('=== OUTGOING RESPONSE ===');
        console.log('Status:', res.statusCode);
        console.log('Headers:', res.getHeaders());
        console.log('Body:', data);
        console.log('=== RESPONSE END ===');
        return originalSend.call(this, data);
      };
      next();
    });

    // Handle preflight requests manually
    this.app.options('*', (req: Request, res: Response) => {
      console.log('OPTIONS request received:', req.method, req.url, 'Origin:', req.headers.origin);
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400'); // 24 hours
      res.sendStatus(200);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  private initializeRoutes(): void {
    // Use all routes
    this.app.use(routes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'CareerBridge API Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          public: '/api/public',
          auth: '/api/auth',
          users: '/api/users',
          health: '/api/health'
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }
}

export default App;