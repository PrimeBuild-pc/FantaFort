# 🎮 FantaFort - Fortnite Fantasy Football Web App 🏆

FantaFort is a Fortnite-themed fantasy football web application that combines sports management with immersive gaming aesthetics, providing users with an engaging team management experience.

![FantaFort Banner](https://github.com/PrimeBuild-pc/FantaFort/blob/main/banner.png)

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Integration](#-api-integration)
- [Contributing](#-contributing)
- [Deployment](#-deployment)

## 🌐 Overview

FantaFort brings the excitement of fantasy sports to the world of Fortnite. Users can build teams from a roster of pro Fortnite players, compete in tournaments, manage their fantasy teams, and climb the leaderboards. The application features both virtual in-game currency and optional real-money prize pools via PayPal.

## ✨ Features

- 👤 **User Authentication**: Secure account creation and login system
- 🏫 **Team Management**: Create and customize your fantasy Fortnite team
- 🛒 **Marketplace**: Acquire and trade pro players for your team
- 🏆 **Tournaments**: Join competitive tournaments with other players
- 📊 **Leaderboards**: Track your performance against other teams
- 📈 **Player Stats**: Real-time Fortnite player statistics integration
- 💰 **Dual Currency System**: Virtual coins for standard gameplay and optional real money for prize pools
- 🔄 **Real-time Updates**: WebSocket integration for live game updates
- 💲 **PayPal Integration**: Secure payment processing for tournament prize pools
- 📱 **Responsive Design**: Optimized for both desktop and mobile devices

## 🔧 Technology Stack

### Frontend
- ⚛️ **React 18** with TypeScript
- 🧭 **Wouter** for routing
- 📊 **Recharts** for data visualization
- 🔄 **TanStack Query** (React Query v5) for data fetching
- 🧩 **ShadCN UI** components
- 💅 **Tailwind CSS** for styling
- 🎭 **Framer Motion** for animations
- 🌐 **WebSockets** for real-time updates

### Backend
- 🟢 **Node.js** with Express
- 🔐 **Passport.js** for authentication
- 🗃️ **PostgreSQL** with Drizzle ORM
- 💳 **PayPal API** integration for payments
- 🎮 **Fortnite API** for player stats

## 📂 Project Structure

```
/
├── .github/               # GitHub configuration
│   └── workflows/        # GitHub Actions workflows
│
├── api/                   # API endpoints for Vercel serverless functions
│   ├── auth-simple.js      # Authentication API
│   ├── team.js            # Team management API
│   ├── prize-pool.js      # Prize pool API
│   ├── health.js           # Health check API
│   └── root.js            # Root API endpoint
│
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions and types
│   │   ├── pages/         # Application pages/routes
│   │   └── assets/        # Static assets like images
│
├── pages/                 # Next.js pages for Vercel deployment
│   ├── index.js           # Home page
│   └── api/              # API routes
│
├── public/                # Static assets
│
├── server/                # Backend Express application
│   ├── auth.ts            # Authentication setup
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API routes
│   ├── fortnite-api.ts    # Fortnite API integration
│   ├── paypal-routes.ts   # PayPal payment processing
│   ├── storage.ts         # Data storage interface
│   └── websocket.ts       # WebSocket server for real-time updates
│
├── shared/                # Shared code between client and server
│   └── schema.ts          # Database schema and types
│
├── build.sh               # Build script for Vercel deployment
├── vercel.json            # Vercel configuration
├── next.config.js         # Next.js configuration
└── drizzle.config.ts      # Drizzle ORM configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- PayPal Developer account (for payment features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/PrimeBuild-pc/FantaFort.git
cd FantaFort
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL=postgresql://username:password@localhost:5432/fantafort
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
SESSION_SECRET=your_session_secret
```

4. Run database migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

## 🔌 API Integration

### Fortnite API

The application integrates with the Fortnite API to fetch real player statistics. If the API is unavailable, the system falls back to sample data.

Key integration points:
- `server/fortnite-api.ts` - Handles API requests and data processing
- `server/player-init.ts` - Initializes player data in the database

### PayPal Integration

FantaFort uses PayPal for handling real-money transactions in tournament prize pools:

- `server/paypal-routes.ts` - API routes for PayPal integration
- `client/src/hooks/use-paypal.tsx` - React hook for PayPal integration
- `client/src/components/paypal-button.tsx` - PayPal payment button component

## 🤝 Contributing

We welcome contributions to FantaFort! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and directory structure
- Write clean, readable, and well-documented code
- Create comprehensive tests for new features
- Update the documentation when making significant changes

## 📦 Deployment

### Vercel Deployment

The application is deployed on Vercel at [https://fantafort.vercel.app](https://fantafort.vercel.app).

#### Manual Deployment

1. Build the client:
```bash
npm run build:supabase
```

2. Deploy to Vercel:
```bash
vercel --prod
```

### GitHub Actions Deployment

This project uses GitHub Actions to automatically build and deploy the application to Vercel. To set up the GitHub Actions workflow, you need to add the following secrets to your GitHub repository:

1. `VERCEL_TOKEN`: Your Vercel API token
   - Get it from https://vercel.com/account/tokens

2. `VERCEL_ORG_ID`: Your Vercel organization ID
   - Value: `team_6SgG2NcJfWNAhGLsjKrbSY4W`

3. `VERCEL_PROJECT_ID`: Your Vercel project ID
   - Value: `prj_7gUIkdkxWgyQB3m3VRdjwAUIUR2N`

4. `VITE_SUPABASE_URL`: Your Supabase URL
   - Value: `https://nxrqxozgbjiegjqgjypa.supabase.co`

5. `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cnF4b3pnYmppZWdqcWdqeXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMDcyNTgsImV4cCI6MjA1OTY4MzI1OH0.se5REjhJrxPW_7hSKNvdeJ_IW09OPs1iTOrM8FKZ67s`

6. `VITE_PAYPAL_CLIENT_ID`: Your PayPal client ID
   - Value: `AYSq3RDGsmBLJE-otTkBtM-jBRd1TCQwFf9RGfwddNXWz0uFU9ztymylOhRS`

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Developed with ❤️ by the FantaFort Team
