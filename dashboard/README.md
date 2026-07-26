# POS SaaS Dashboard

Complete web dashboard for superadmin and merchant management in the POS SaaS platform.

## Features

### Superadmin Dashboard
- **Overview**: Platform statistics, revenue trends, merchant distribution
- **Merchants**: Manage merchant accounts, view details, suspend/activate
- **Licenses**: Generate and manage license codes, track expiry
- **Analytics**: Platform-wide analytics and reporting
- **Settings**: Configure platform settings and subscription plans

### Merchant Dashboard
- **Overview**: Business statistics, sales trends, top products
- **Orders**: Manage orders from POS and web shop
- **Products**: Manage product catalog and inventory
- **Customers**: View customer profiles and purchase history
- **Loyalty**: Manage loyalty cards and gift cards
- **Settings**: Configure business info, taxes, and payment methods

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Build Tool**: Vite

## Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update API URL if needed
# VITE_API_URL=http://localhost:3000/api
```

## Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

## Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── ProtectedRoute.tsx
├── pages/              # Page components
│   ├── LoginPage.tsx
│   ├── superadmin/
│   │   ├── Dashboard.tsx
│   │   ├── Overview.tsx
│   │   ├── Merchants.tsx
│   │   ├── Licenses.tsx
│   │   ├── Analytics.tsx
│   │   └── Settings.tsx
│   └── merchant/
│       ├── Dashboard.tsx
│       ├── Overview.tsx
│       ├── Orders.tsx
│       ├── Products.tsx
│       ├── Customers.tsx
│       ├── Loyalty.tsx
│       └── Settings.tsx
├── store/              # Zustand stores
│   └── auth.ts
├── lib/                # Utilities
│   └── api.ts
├── App.tsx            # Main app component
├── main.tsx           # Entry point
└── index.css          # Global styles
```

## Authentication

The dashboard uses JWT token-based authentication:

1. User logs in with email/password and role
2. Backend returns JWT token
3. Token is stored in localStorage
4. Token is sent with every API request
5. Protected routes check for valid token

### Login Credentials (Demo)

**Merchant:**
- Email: `merchant@example.com`
- Password: `password123`

**Superadmin:**
- Email: `admin@example.com`
- Password: `password123`

## API Integration

All API calls are made through the `api` client in `src/lib/api.ts`:

```typescript
import api from '@/lib/api';

// GET request
const response = await api.get('/endpoint');

// POST request
const response = await api.post('/endpoint', data);

// PUT request
const response = await api.put('/endpoint', data);

// DELETE request
await api.delete('/endpoint');
```

The API client automatically:
- Adds JWT token to request headers
- Handles 401 errors (redirects to login)
- Uses configured base URL from `.env`

## State Management

Using Zustand for global state:

```typescript
import { useAuthStore } from '@/store/auth';

const { user, token, setUser, setToken, logout } = useAuthStore();
```

## Styling

Using Tailwind CSS with custom utility classes:

- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.card` - Card container
- `.input` - Input field

## Deployment

### Vercel

```bash
# Push to GitHub
git push origin main

# Connect repository to Vercel
# Vercel will automatically deploy on push
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:3000/api` |

## Performance Optimization

- Code splitting with React Router
- Lazy loading of pages
- Image optimization
- CSS minification
- JavaScript minification
- Gzip compression

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - POS SaaS Platform

## Support

For issues or questions, contact: support@pos-saas.com
