# 💰 My Accounts - Personal Finance Manager

A modern, fast, and mobile-first application to track your expenses and income, built with **React Admin** and **Supabase**.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?style=flat&logo=supabase&logoColor=white)
![Material UI](https://img.shields.io/badge/Material--UI-5.15-007FFF.svg?style=flat&logo=mui&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg?style=flat&logo=pwa&logoColor=white)

## ✨ Features

- **📱 Mobile First & PWA**: Optimized interface for mobile, installable as a native application.
- **📊 Monthly Reports**: Automatic report generation with balance tracking (initial, final, reconciled).
- **📈 Visualization**: Charts showing expense and income evolution by category.
- **🌗 Dark Mode**: Full support for light and dark themes.
- **📥 CSV Import**: Easy import of your bank statements.
- **🏷️ Categorization**: Flexible category management with budgets and colors.
- **✅ Reconciliation**: Bank reconciliation system (operation matching).
- **🔒 Secure**: Authentication and Row Level Security (RLS) via Supabase.

## 🎮 Demo

A live demo is available at: [https://account-c6a3f.web.app](https://account-c6a3f.web.app)

**Credentials:**
- **Email:** `demo@mydomain.tld`
- **Password:** `DemoPassword1!`

## 🚀 Technologies

- **Frontend**: React, TypeScript, React Admin, Material UI, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Build**: Vite, Vite PWA

## 🛠️ Installation

### 1. Clone the project

```bash
git clone https://github.com/CrokNoks/account.git
cd account
npm install
```

### 2. Configure Supabase

1. Create a project on [Supabase](https://supabase.com).
2. Run the SQL script provided in `supabase/schema.sql` via the Supabase SQL editor to create tables and security policies.

### 3. Environment Variables

Create a `.env` file at the root of the project by copying `.env.example`:

```bash
cp .env.example .env
```

Fill in the variables with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

### 4. Start the application

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

## 📱 PWA (Progressive Web App)

The application is configured as a PWA. Once deployed (or locally with HTTPS), you can install it on your phone via the browser ("Add to Home Screen").

## 📅 Roadmap

- [ ] Improve category display
- [ ] OCR for receipts
- [ ] PDF generation with customizable information

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or a Pull Request.

1. Fork the project
2. Create a branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT license.
