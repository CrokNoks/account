module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'functions/dist'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    'react-refresh',
    '@typescript-eslint',
    'react-hooks'
  ],
  rules: {
    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': 'off', // Allow implicit return types for flexibility
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // React rules
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    
    // General code quality rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      // React-specific rules for frontend files only
      files: ['src/**/*.{ts,tsx}'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
      ],
      plugins: ['react'],
      rules: {
        'react/jsx-no-useless-fragment': 'error',
        'react/no-array-index-key': 'warn',
        'react/jsx-key': 'error',
        'react/prop-types': 'off', // We use TypeScript for props
      },
    },
    {
      // Backend-only rules for functions
      files: ['functions/src/**/*.{ts,tsx}'],
      rules: {
        'no-console': 'off', // Allow console in backend for debugging
      },
    },
  ],
};