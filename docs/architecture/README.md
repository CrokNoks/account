# 📚 Account v2 Backend Architecture Documentation

Welcome to the comprehensive backend documentation for Account v2. This directory contains technical guides, implementation details, and architectural patterns for the NestJS backend services.

## 📁 Structure

- **[firebase-functions-nestjs.md](./firebase-functions-nestjs.md)** - Firebase Functions integration with NestJS
- **[nestjs-architecture.md](./nestjs-architecture.md)** - NestJS architectural patterns and best practices
- **[nestjs-typescript-general.md](./nestjs-typescript-general.md)** - TypeScript coding standards and patterns

## 🎯 Focus Areas

### Firebase Functions + NestJS Integration
- Serverless deployment strategies
- Authentication and authorization patterns
- Data validation and error handling
- Performance optimization techniques

### NestJS Architecture
- Module organization and dependency injection
- Controller, service, and repository patterns
- Testing strategies and best practices

### TypeScript Standards
- Type safety patterns and interfaces
- Configuration and compilation options
- Code quality and linting rules

## Overview

The Firebase Functions project has been refactored to follow NestJS best practices and the rules defined in `rules/` directory:
- [nestjs-typescript-general.md](../rules/nestjs-typescript-general.md)
- [nestjs-architecture.md](../rules/nestjs-architecture.md)
- [firebase-functions-nestjs.md](../rules/firebase-functions-nestjs.md)

## Project Structure

```
functions/src/
├── index.ts                      # Entry point with optimized cold start
├── app.module.ts                 # Root module imports all features
├── app.service.ts                # Root service (health checks)
├── app.controller.ts             # Root controller (API status endpoints)
│
├── core/                         # Global application services
│   ├── core.module.ts            # Global filters registration
│   └── filters/
│       └── http-exception.filter.ts  # Normalize all HTTP exceptions
│
├── shared/                       # Services shared between modules
│   ├── shared.module.ts
│   ├── logger.service.ts         # Centralized logger
│   └── ...
│
├── budgets/                      # Feature module: Budget management
│   ├── budgets.module.ts
│   ├── budgets.controller.ts     # Budget endpoints
│   ├── budgets.service.ts        # Budget business logic
│   ├── ai-budget.service.ts      # AI budget prediction service
│   ├── budget-templates.controller.ts
│   ├── budget-templates.service.ts
│   └── models/
│       └── ... (DTOs will be added here)
│
├── periods/                      # Feature module: Period management
│   ├── periods.module.ts
│   ├── periods.controller.ts     # Period endpoints
│   ├── periods.service.ts        # Period business logic
│   └── models/
│       └── ... (DTOs will be added here)
│
├── supabase/                     # Feature module: Database integration
│   ├── supabase.module.ts
│   ├── supabase.service.ts       # Supabase client management
│   └── ...
│
└── utils/
    └── ... (Helper functions)
```

## Key Improvements

### 1. Cold Start Optimization
- NestJS app instance is cached in `index.ts`
- Server is reused across invocations
- Import structure optimized to minimize bundle

### 2. Global Error Handling
- All exceptions normalized via `HttpExceptionFilter`
- Consistent error response format with timestamp
- Proper HTTP status codes

### 3. Better Documentation
- JSDoc comments on all public classes and methods
- Clear parameter and return type documentation
- Exception documentation

### 4. Type Safety
- All methods have explicit return types
- Proper exception types (BadRequestException, NotFoundException, InternalServerErrorException)
- Interfaces for DTOs

### 5. Logging
- Logger instances injected where needed
- Consistent logging format across services
- Error context preservation

## Feature Modules

### Budgets Module
- **Controller**: `BudgetsController`
  - `GET /budgets?period_id={id}` - Get budgets for a period
  - Includes related category data
  
- **Services**:
  - `BudgetsService` - CRUD operations for budgets
  - `AiBudgetService` - AI-powered budget predictions

### Periods Module
- **Controller**: `PeriodsController`
  - `GET /periods?account_id={id}` - List all periods
  - `GET /periods/active?account_id={id}` - Get active period
  - `GET /periods/{id}` - Get period details
  - `GET /periods/{id}/report` - Get financial report
  - `POST /periods` - Create new period with budgets
  - `POST /periods/{id}/close` - Close a period
  - `POST /periods/preview` - Preview next period with AI suggestions
  - `DELETE /periods/{id}` - Delete period
  
- **Service**: `PeriodsService`
  - Period CRUD operations
  - Budget generation for new periods
  - Active period management
  - Financial reporting

## Next Steps

1. **Create DTOs for input validation** - Add `models/` folders with class-validator decorated DTOs
2. **Add authentication guards** - Create Firebase auth guard
3. **Add request/response interceptors** - Transform data before sending to client
4. **Improve Supabase module** - Add better type definitions
5. **Add integration tests** - Test complete API flows
6. **Add smoke test endpoints** - Add `/admin/test` endpoints to each controller
7. **Configure memory and timeout** - Adjust firebase.json for performance

## References

See the rules files for more details:
- [Firebase Functions Best Practices](../rules/firebase-functions-nestjs.md)
- [NestJS Architecture](../rules/nestjs-architecture.md)
- [NestJS/TypeScript General Guidelines](../rules/nestjs-typescript-general.md)
