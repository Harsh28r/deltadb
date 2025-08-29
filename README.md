# DeltaYards CRM System

A comprehensive CRM system built with Node.js, Express, and MongoDB for project and lead management.

## Features

- **User Management**: Role-based access control with hierarchical permissions
- **Project Management**: Create, manage, and assign users to projects
- **Lead Management**: Track leads with project association and status management
- **Real-time Updates**: Socket.io integration for live updates
- **RESTful API**: Complete CRUD operations for all entities

## Quick Start

### Prerequisites
- Node.js >= 16.0.0
- MongoDB database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DeltaYardsCRM-master
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env-template.txt .env
   # Edit .env with your MongoDB URI and JWT secret
   ```

4. **Start the server**
   ```bash
   npm start          # Production mode
   npm run dev        # Development mode with nodemon
   ```

The server will start on port 5000 by default.

## API Endpoints

### Authentication
- `POST /api/superadmin/admin-login` - Admin login
- `POST /api/users/login` - User login

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id/members` - Add/remove project members
- `PUT /api/projects/:id/role` - Assign roles in project

### Leads
- `GET /api/leads` - Get all leads (with optional projectId filter)
- `GET /api/leads/:id` - Get specific lead
- `POST /api/leads` - Create new lead
- `PUT /api/leads/:id` - Update lead
- `PUT /api/leads/:id/status` - Change lead status
- `DELETE /api/leads/:id` - Delete lead

### Lead Sources & Statuses
- `GET /api/lead-sources` - Get lead sources
- `GET /api/lead-statuses` - Get lead statuses

## Project Structure

```
├── controllers/          # Business logic
├── middleware/           # Authentication & authorization
├── models/              # MongoDB schemas
├── routes/              # API route definitions
├── server.js            # Main server file
└── package.json         # Dependencies & scripts
```

## Database Models

### User
- Basic info (name, email, password)
- Role-based permissions
- Project memberships

### Project
- Project details (name, location, developer)
- Owner and member management
- Role assignments within projects

### Lead
- Lead information with project association
- Status tracking with history
- Custom data fields support

## Authentication

The system uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Development

- **Backend**: Node.js + Express + MongoDB
- **Real-time**: Socket.io for live updates
- **Validation**: Joi for request validation
- **File Upload**: Multer for file handling
- **Rate Limiting**: Express rate limiter

## Troubleshooting

### Common Issues

1. **MongoDB Connection**: Ensure your MongoDB URI is correct in `.env`
2. **JWT Secret**: Set a strong JWT_SECRET in environment variables
3. **Port Conflicts**: Change PORT in `.env` if 5000 is occupied

### API Testing

Test the API endpoints using tools like:
- Postman
- Insomnia
- curl commands

Example curl command:
```bash
curl -X GET http://localhost:5000/api/projects \
  -H "Authorization: Bearer <your-token>"
```

## License

MIT License - see LICENSE file for details