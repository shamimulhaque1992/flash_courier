# Flash Courier API

Flash Courier is a courier and shipment-management backend. It supports merchant and rider onboarding, shipment creation and tracking, rider schedules, payments, reviews, analytics, and admin operations.

Live API: [https://flash-courier.vercel.app/api/v1](https://flash-courier.vercel.app/api/v1)

## Tech Stack

- Node.js, TypeScript, and Express
- PostgreSQL with Prisma ORM
- Redis for temporary data and OTPs
- JWT authentication with cookie or Bearer-token support
- bKash payment integration
- Cloudinary for document and profile-image uploads
- Zod validation and Biome formatting/linting

## Project Setup

Requirements: Node.js 20+, PostgreSQL, Redis, and the required Cloudinary, email, JWT, and bKash credentials.

```bash
npm install
# Create .env with the required database, Redis, JWT, email, Cloudinary, and bKash values.
npx prisma generate
npx prisma migrate dev
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The API documentation is available in [documentation.md](documentation.md).
