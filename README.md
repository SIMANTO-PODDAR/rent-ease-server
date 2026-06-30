# Rent-Ease Backend

This repository contains the backend/server-side application for Rent-Ease, a modern property rental platform built to support secure property discovery, bookings, payments, favorites, dashboards, and role-based user management.

## Client Application

- Live Client: <https://rent-ease-by-simanto.vercel.app>
- Client Repository: <https://github.com/SIMANTO-PODDAR/Rent-Ease.git>

## Purpose

The Rent-Ease backend powers the server-side operations of the platform by handling authentication, authorization, database operations, bookings, payments, dashboards, and business logic. It serves as the secure foundation for a modern and scalable property rental experience.

---

<div align="center">
  <table border="0" cellpadding="0" cellspacing="0">
    <tr>
      <td valign="top" width="60%">
        <img src="https://i.ibb.co.com/kstsRwbQ/Rent-Ease-desktop-view.jpg" alt="Rent-ease Desktop View" width="100%" style="border-radius: 8px;" />
      </td>
      <td valign="top" width="35%">
        <img src="https://i.ibb.co.com/wh6FcQ68/Rent-Ease-mobile-view.jpg" alt="Rent-ease Mobile View" width="100%" style="border-radius: 8px;" />
      </td>
    </tr>
  </table>
</div>
<br />

## Core Features

- RESTful API architecture
- JWT-based authentication
- Role-based authorization for Admin, Owner, and Tenant
- Secure protected routes
- Payment processing with Stripe
- User management
- Admin controls
- Owner & Tenant dashboard support
- MongoDB database integration
- Secure error handling
- Request validation
- Efficient database queries
- Scalable backend architecture

## Security

The backend is designed with security and reliability in mind. JWT is used to secure protected routes, while role-based middleware restricts access based on user roles. Sensitive operations require authentication, payments are handled securely through Stripe, and environment variables are used for secrets and configuration.

Key security practices include:

- JWT-based authentication for protected routes
- Role-based authorization for Admin, Owner, and Tenant users
- Middleware-based access control for sensitive operations
- Secure handling of payment-related workflows
- Environment-based configuration for secrets and settings
- No sensitive credentials stored in source code
- Validation and authorization enforced throughout the API

## Technology Stack

| Category | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| Authentication | JWT |
| Session/Auth Helpers | Better Auth |
| Environment Configuration | dotenv |
| Cross-Origin Handling | CORS |
| Payment Processing | Stripe |
| Validation | express-validator |

## Installation

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the required environment variables.
4. Start the development server:

   ```bash
   npm start
   ```

## Environment Variables

Example configuration:

```env
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:3000
PORT=5000
```

## Authentication & Authorization

The backend uses JWT authentication to verify users and protect routes. Middleware validates incoming tokens and enforces role-based access control for different users, including:

- Admin: full platform oversight and administrative actions
- Owner: property and booking management for their listings
- Tenant: booking, favorites, and personal account actions

Protected routes ensure that sensitive operations are only accessible to authorized users.

## Database

MongoDB is used as the primary database for storing and managing application data. The backend supports efficient CRUD operations across collections such as users, properties, bookings, favorites, and payments. Indexing, data relationships, and optimized queries are used where appropriate to support scalable performance.

## Error Handling

The API uses centralized error handling to provide consistent responses, proper HTTP status codes, and meaningful validation errors. This approach improves reliability and ensures a predictable experience for clients and developers.

## Conclusion

Rent-Ease Backend is a scalable, secure, and maintainable server-side foundation for the Rent-Ease platform. It is designed to support a modern property rental experience with strong business logic, robust authorization, and reliable data management.
