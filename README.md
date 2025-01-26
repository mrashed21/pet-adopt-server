# Pet Adoption System - Backend

## Overview
This is the backend service for a Pet Adoption System integrated with donation campaigns. It provides RESTful APIs for managing users, pets, donations, and admin functionalities. The system also integrates payment processing using Stripe.

## Client URL

The client-side application for this backend can be accessed at:

**Client URL**: [Client URL](https://pet-adopt-web.netlify.app)


## Features
- **User Management**
  - User authentication with JWT.
  - Role-based access control (User/Admin).

- **Pet Management**
  - Manage pet details (Admin).
  
- **Donation Campaigns**
  - Create, update, fetch, pause/unpause, and delete campaigns.
  - Donate to campaigns with payment processing (Stripe).
  - Refund donation requests.
  - Fetch donators and recommended campaigns.

- **Admin Features**
  - Manage all users.
  - Assign/revoke admin roles.
  - Access to all donation campaigns and pets.

## Technologies Used
- **Node.js** with **Express.js** for building APIs.
- **MongoDB** for database.
- **Stripe** for payment processing.
- **JWT** for authentication.

## Installation

### Prerequisites
Ensure you have the following installed:
- Node.js
- MongoDB

### Steps
1. Clone the repository:
   ```bash
   git clone <https://github.com/mrashed21/pet-adopt-server>
   cd pet-adoption-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following values:
   ```env
   PORT=5000
   MONGO_URI=<your-mongo-uri>
   JWT_SECRET=<your-jwt-secret>
   STRIPE_SECRET_KEY=<your-stripe-secret-key>
   ```

4. Start the server:
   ```bash
   npm start
   ```
   The server will run on the port specified in the `.env` file (default: 5000).

## API Endpoints

### User Management
| Method | Endpoint          | Description                      |
|--------|-------------------|----------------------------------|
| POST   | `/login`          | Log in a user and return a token.|
| POST   | `/register`       | Register a new user.             |
| GET    | `/user/me`        | Fetch logged-in user details.    |

### Pet Management
| Method | Endpoint          | Description                      |
|--------|-------------------|----------------------------------|
| GET    | `/admin/pets`     | Get all pets (Admin only).       |

### Donation Campaigns
| Method | Endpoint                      | Description                      |
|--------|-------------------------------|----------------------------------|
| GET    | `/donations/:id`             | Get a specific donation campaign.|
| GET    | `/donations/user/:email`     | Get campaigns created by a user. |
| GET    | `/donations/recommended/:id` | Get recommended campaigns.       |
| POST   | `/donations/:id/donate`      | Donate to a campaign (Stripe).   |
| PATCH  | `/donations/update/:id`      | Update a donation campaign.      |
| PATCH  | `/donations/pause/:id`       | Pause/unpause a campaign.        |
| POST   | `/donations/refund/:id`      | Process a refund request.        |

### Admin Features
| Method | Endpoint             | Description                      |
|--------|----------------------|----------------------------------|
| GET    | `/admin/users`       | Get all users.                   |
| PUT    | `/admin/users/:id`   | Assign/revoke admin role.         |
| GET    | `/admin/donation`    | Get all donation campaigns.       |
| DELETE | `/admin/donations/:id` | Delete a donation campaign.       |

## Middleware
- **verifyToken**: Ensures the user is authenticated.
- **verifyAdmin**: Ensures the user is an admin.

## Payment Integration
Stripe is used for secure payment processing. Donation details, including donor information, are stored in the database upon successful payment.

## Error Handling
The application includes robust error handling with descriptive error messages for:
- Invalid inputs.
- Unauthorized actions.
- Database errors.

