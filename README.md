# 💰 Account V2 - Personal Finance Manager

A modern, robust, and full-featured personal finance management application. Built with a clean architecture using **Next.js 15**, **NestJS 11**, and **Supabase**.

![Version](https://img.shields.io/badge/version-2.6.0-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg?style=flat&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E.svg?style=flat&logo=nestjs)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?style=flat&logo=supabase)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4.svg?style=flat&logo=tailwind-css)

## ✨ Key Features

- **👥 Multi-Account Sharing**: Create multiple bank accounts and share them with other users with specific permissions (Read/Write).
- **📅 Period-Based Budgeting**: Organize your finances into custom financial periods with dedicated budgets per category.
- **🔄 Recurring Transactions**: Automate your monthly expenses and income. Injected as "Pending" at the start of each period for verification.
- **⏳ Pre-authorization & Pending Status**: Track transactions that are not yet cleared at the bank (e.g., gas station pre-auths, upcoming rent).
- **✅ Bank Reconciliation**: Easily match your app transactions with your bank statement (pointing system).
- **🤖 AI-Powered Categorization**: Automatic category suggestion based on transaction descriptions using natural language processing.
- **📊 Comprehensive Reporting**:
  - **Evolution Charts**: Track your balance and cash flow over time.
  - **Budget Breakdown**: Visualize your spending vs. budget in real-time.
  - **Forecasts**: Predictive balance based on planned expenses and income.
- **⌨️ Power User Shortcuts**: Navigate the entire app lightning-fast with F2-F10 keys and context-aware shortcuts (Enter to add, etc.).
- **🌍 Internationalization**: Full support for English and French.

## 🚀 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query) v5
- **Styling**: Tailwind CSS 4 + Shadcn/UI (Radix UI)
- **Internationalization**: next-intl
- **Icons**: Lucide React

### Backend
- **Framework**: NestJS 11
- **Deployment**: Firebase Functions
- **Auth & Database**: Supabase (PostgreSQL)
- **Validation**: Class-validator & Class-transformer

## 🛠️ Project Structure

```text
├── frontend/             # Next.js web application
├── functions/            # NestJS API (Firebase Functions)
├── supabase/             # Database migrations and configuration
├── scripts/              # Release and utility scripts
└── README.md             # This file
```

## 📦 Getting Started

### 1. Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- A Supabase project

### 2. Installation
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install

# Install functions dependencies
cd ../functions && npm install
```

### 3. Environment Setup
Create `.env` files in both `frontend/` and `functions/` based on their respective `.env.example` files.

**Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

**Functions (.env):**
```env
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Database Setup
Apply migrations to your Supabase project:
```bash
# Using Supabase CLI
supabase db push
```

### 5. Running Locally
```bash
# Start frontend (from /frontend)
npm run dev

# Start backend (from /functions)
npm run start:dev
```

## 🚢 Deployment

The project is configured for deployment via Firebase.

```bash
# Deploy everything
npm run deploy:all

# Or deploy specifically
npm run deploy:frontend
npm run deploy:backend
```

## 📄 License

This project is currently UNLICENSED.
