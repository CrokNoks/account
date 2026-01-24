# Firebase Functions - NestJS Best Practices

## Project Structure

### Functions Organization
- **Each Firebase Function** = one public function with a specific trigger
- Use NestJS as a framework for application logic
- Export each Firebase Function in the entry point (`index.ts`)
- One configuration file for environment variables

### Recommended Architecture

```
functions/
├── src/
│   ├── index.ts                    # Entry point, export functions
│   ├── app.module.ts               # Main module
│   ├── app.service.ts              # Business service
│   └── [feature]/
│       ├── [feature].module.ts
│       ├── [feature].controller.ts
│       ├── [feature].service.ts
│       ├── entities/
│       └── models/
├── package.json
├── tsconfig.json
└── .env
```

## Firebase Triggers

### HTTP Functions
```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

let cachedApp: any

async function bootstrap() {
  if (!cachedApp) {
    cachedApp = await NestFactory.create(AppModule)
    await cachedApp.init()
  }
  return cachedApp
}

export const api = functions.https.onRequest(async (req, res) => {
  const app = await bootstrap()
  const handler = app.getHttpAdapter().getInstance()
  handler(req, res)
})
```

### Firestore Triggers
```typescript
export const onCreateUser = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userService = app.get(UserService)
    await userService.handleNewUser(snap.data(), context.params.userId)
  })

export const onUpdateProfile = functions.firestore
  .document('users/{userId}/profile/{profileId}')
  .onUpdate(async (change, context) => {
    const profileService = app.get(ProfileService)
    await profileService.handleProfileUpdate(change.before, change.after)
  })
```

### Realtime Database Triggers
```typescript
export const onDataChange = functions.database
  .ref('users/{userId}/data')
  .onWrite(async (change, context) => {
    const dataService = app.get(DataService)
    const before = change.before.val()
    const after = change.after.val()
    await dataService.processDataChange(before, after, context.params.userId)
  })
```

### Pub/Sub Triggers
```typescript
export const processQueue = functions.pubsub
  .topic('task-queue')
  .onPublish(async (message) => {
    const taskService = app.get(TaskService)
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString())
    await taskService.executeTask(data)
  })
```

### Scheduled Functions
```typescript
export const dailyCleanup = functions.pubsub
  .schedule('every day 02:00')
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    const cleanupService = app.get(CleanupService)
    await cleanupService.performDailyCleanup()
  })
```

## Request Context Management

### Injectable Context Provider
```typescript
import { Injectable } from '@nestjs/common'
import * as functions from 'firebase-functions'

@Injectable()
export class FirebaseContextService {
  getContext() {
    return functions.config()
  }

  getProjectId(): string {
    return process.env.GCLOUD_PROJECT || 'unknown'
  }

  getEnvironment(): string {
    return process.env.ENVIRONMENT || 'development'
  }
}
```

### Create a Permission Guard
```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import * as admin from 'firebase-admin'

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)

    if (!token) return false

    try {
      const decodedToken = await admin.auth().verifyIdToken(token)
      request.user = decodedToken
      return true
    } catch {
      return false
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization
    return authHeader?.split(' ')[1] || null
  }
}
```

## Performance Optimization

### Cold Start Optimization
- Initialize NestJS once and reuse the instance (see caching above)
- Minimize imports at startup
- Use lazy imports for non-critical modules

### Memory Management
- Default Functions: 256 MB
- Increase if necessary based on needs
- Avoid memory leaks by cleaning up resources

```typescript
export const cleanupService = functions.https.onRequest(async (req, res) => {
  try {
    const app = await bootstrap()
    const cleaner = app.get(CleanerService)
    await cleaner.cleanup()
    res.send({ success: true })
  } finally {
    // Ensure connections are closed
  }
})
```

### Timeout Configuration
```typescript
export const longRunningTask = functions
  .runWith({
    timeoutSeconds: 540,  // 9 minutes max
    memory: '512MB'
  })
  .https
  .onRequest(async (req, res) => {
    // Implementation
  })
```

## Logging and Monitoring

### Custom Logger
```typescript
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class FirebaseLoggerService {
  private logger = new Logger('Firebase')

  log(message: string, context?: string): void {
    this.logger.log(message, context)
    console.log(`[${context}] ${message}`)
  }

  error(message: string, error?: any, context?: string): void {
    this.logger.error(message, error, context)
    console.error(`[${context}] ${message}`, error)
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, context)
  }
}
```

## Environment Variables

### Firebase Configuration
```
GCLOUD_PROJECT=my-project-id
ENVIRONMENT=production
API_KEY=xxx
DATABASE_URL=https://xxx.firebaseio.com
```

### Access in NestJS
```typescript
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getProjectId(): string {
    return this.configService.get<string>('GCLOUD_PROJECT') || 'unknown'
  }
}
```

## Testing

### Test an HTTP Function
```typescript
import { Test } from '@nestjs/testing'
import { AppModule } from './app.module'

describe('API Function', () => {
  let app: any

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  it('should handle GET /health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
  })
})
```

### Test a Firestore Trigger Function
```typescript
describe('Firestore Triggers', () => {
  it('should process new user creation', async () => {
    const userService = app.get(UserService)
    const spyHandle = jest.spyOn(userService, 'handleNewUser')

    const userData = { email: 'test@example.com' }
    await userService.handleNewUser(userData, 'user-123')

    expect(spyHandle).toHaveBeenCalledWith(userData, 'user-123')
  })
})
```

## Deployment

### Deployment Script
```json
{
  "scripts": {
    "build": "tsc",
    "serve": "firebase emulators:start",
    "deploy": "firebase deploy --only functions"
  }
}
```

### Pre-Deployment Checklist
- ✅ All tests pass
- ✅ Environment variables configured
- ✅ Logging in place for debugging
- ✅ Complete error handling
- ✅ Appropriate timeouts configured
- ✅ Sufficient memory allocated
- ✅ Code minified and optimized
