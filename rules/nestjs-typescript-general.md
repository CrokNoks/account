# NestJS + TypeScript - General Guidelines

## Basic Principles

### Code & Documentation
- Use English for all code and documentation
- Always declare the type of each variable and function (parameters and return value)
- Avoid using `any`
- Create necessary types
- Use JSDoc to document public classes and methods
- No blank lines within a function
- One export per file

## Nomenclature

### Cases
- `PascalCase` for classes
- `camelCase` for variables, functions, and methods
- `kebab-case` for file and directory names
- `UPPERCASE` for environment variables

### Constants and Magic Numbers
- Avoid magic numbers and define constants
- Use complete words instead of abbreviations
- Standard exceptions: API, URL, i, j (loops), err, ctx, req, res, next

### Functions and Boolean Variables
- Start each function with a verb
- For booleans: `isX`, `hasX`, `canX`
- For actions: `executeX`, `saveX`

## Functions

- Write short functions with a single purpose (< 20 instructions)
- Name functions with a verb and something else
- Avoid nesting blocks by:
  - Early checks and returns
  - Extraction to utility functions
  - Using higher-order functions (map, filter, reduce)
- Use arrow functions for simple functions (< 3 instructions)
- Use named functions for non-simple functions

### Parameters and Returns
- Use default parameter values instead of checking null/undefined
- Reduce function parameters using RO-RO (Return Object - Receive Object)
- Use an object to pass multiple parameters
- Use an object to return results
- Declare necessary types for input arguments and output

## Data

- Don't abuse primitive types, encapsulate data in composite types
- Avoid data validations in functions, use classes with internal validation
- Prefer immutability for data
- Use `readonly` for data that doesn't change
- Use `as const` for literals that don't change

## Classes

- Follow SOLID principles
- Prefer composition over inheritance
- Declare interfaces to define contracts
- Write small classes with a single purpose
  - < 200 instructions
  - < 10 public methods
  - < 10 properties

## Exceptions

- Use exceptions to handle errors you don't expect
- If you catch an exception, it should be to:
  - Fix an expected problem
  - Add context
  - Otherwise, use a global handler
