import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import * as admin from 'firebase-admin';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/** Cached NestJS application instance to optimize cold start times */
let cachedApp: any = null;

/**
 * Creates a NestJS application with Express adapter and enables CORS
 * @param expressInstance - Express server instance
 */
async function bootstrapNestApp(expressInstance: express.Express): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.init();
}

/**
 * Initializes and returns the NestJS application
 * Reuses cached instance if available to minimize cold start time
 * @returns Promise that resolves to the cached Express server
 */
async function getOrCreateServer(): Promise<express.Express> {
  if (cachedApp) {
    return cachedApp;
  }

  const server = express();
  server.use(cors({ origin: true }));

  try {
    await bootstrapNestApp(server);
    cachedApp = server;
  } catch (error) {
    console.error('Failed to initialize NestJS application:', error);
    throw error;
  }

  return server;
}

/**
 * Firebase HTTP function that handles all API requests
 * Routes requests through the NestJS application
 */
export const api = functions.https.onRequest(async (req, res) => {
  try {
    const server = await getOrCreateServer();
    server(req, res);
  } catch (error) {
    console.error('API function error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
