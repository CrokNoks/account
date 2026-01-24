# NestJS - Architecture and Specific Principles

## Modular Architecture

### Module Structure
- **One module per main domain/route**
- One controller for its main route
- Other controllers for secondary routes
- A `models` folder with data types

### DTOs and Types
- **DTOs** validated with `class-validator` for inputs
- Simple types declared for outputs
- Always validate input data

### Services and Business Logic
- **A services module** with business logic and persistence
- **Entities** with MikroORM for data persistence
- **One service per entity**
- Contain business logic in services

### Core Module
- **Global filters** for exception handling
- **Global middlewares** for request management
- **Guards** for permission management
- **Interceptors** for request/response transformation

### Shared Module
- Services shared between modules
- Utilities
- Shared business logic

## Recommended File Structure

```
src/
├── app.module.ts
├── app.service.ts
├── app.controller.ts
├── core/
│   ├── core.module.ts
│   ├── filters/
│   ├── interceptors/
│   ├── guards/
│   └── middlewares/
├── shared/
│   ├── shared.module.ts
│   └── services/
├── [domain]/
│   ├── [domain].module.ts
│   ├── [domain].controller.ts
│   ├── [domain].service.ts
│   ├── entities/
│   │   └── [domain].entity.ts
│   ├── models/
│   │   ├── create-[domain].dto.ts
│   │   ├── update-[domain].dto.ts
│   │   └── [domain].type.ts
│   └── utils/
└── utils/
    └── helpers.ts
```

## Controllers

- **One controller** for main CRUD operations of a route
- **Secondary controllers** for sub-resources
- Add an `admin` or `test` method to each controller for smoke tests
- Controllers should be thin (use services)

## Services

- **One service per entity** for data access
- Encapsulate business logic in services
- Services should be reusable
- Handle errors and edge cases in services

## Validation

- Use `class-validator` for DTOs
- Validate all user input
- Create custom validators if necessary

## Error Handling

- Use **global filters** to normalize error responses
- Use appropriate HTTP exceptions (BadRequestException, NotFoundException, etc.)
- Always provide explicit error messages
- Log errors for debugging

## Testing

- Use **Jest** as testing framework
- Write tests for each controller and service
- Write integration tests (end-to-end) for each API module
- Add a smoke test method (`admin/test`) to each controller
- Use test doubles to simulate dependencies
- Exception: third-party dependencies that are not expensive to execute

### Test Convention
- Use **Arrange-Act-Assert** for unit tests
- Use **Given-When-Then** for acceptance tests
- Name test variables clearly: `inputX`, `mockX`, `actualX`, `expectedX`
