# API Guide

## Introduction

This API provides the backend services for the application. It follows RESTful conventions and uses JSON for request and response bodies.

This guide provides an overview of the API, its core concepts, and how to use it effectively.

## Base URLs

| Environment | URL                         |
| ----------- | --------------------------- |
| Development | http://localhost:10020      |
| Production  | https://api.your-domain.com |

All API endpoints are prefixed with `/v1/` to indicate the API version.

## Authentication

The API supports JWT-based authentication.

### Obtaining a Token

Authenticate using your preferred method to receive a JWT token.

### Using the Token

Include the JWT token in subsequent API requests using the `Authorization` header:

```
Authorization: Bearer <token>
```

### Service Authentication

For service-to-service communication, specific endpoints use basic authentication with API keys.

## Core Resources

### Users

Users represent accounts that can interact with the application.

**Key Endpoints:**

- `GET /v1/users/me` - Get current user information
- `GET /v1/users/search` - Search for users
- `GET /v1/users/:userId` - Get user details
- `PUT /v1/users/:userId` - Update user details

**User Features:**

- Authentication through JWT tokens
- Profile management
- Role-based access control

## Common Patterns

### Pagination

Many list endpoints support pagination using `limit` and `offset` query parameters:

```
GET /v1/resources?limit=10&offset=20
```

### Filtering

Search endpoints typically accept filter criteria through query parameters:

```
GET /v1/users/search?query=john&role=admin
```

### Error Handling

All API errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "errorMessage": "Human-readable error description"
}
```

**Common HTTP status codes:**

| Status | Description                              |
| ------ | ---------------------------------------- |
| 200    | Success                                  |
| 201    | Resource created                         |
| 400    | Bad request (invalid parameters)         |
| 401    | Unauthorized (authentication required)   |
| 403    | Forbidden (insufficient permissions)     |
| 404    | Resource not found                       |
| 409    | Conflict (e.g., resource already exists) |
| 500    | Server error                             |

## Best Practices

- **Authentication**: Always include the JWT token for authenticated endpoints
- **Pagination**: Use pagination for large result sets to improve performance
- **Error Handling**: Check for error responses and handle them appropriately
- **Validation**: Validate input on the client side before sending requests

## Further Resources

For detailed schema information and endpoint specifications, refer to the interactive API documentation available at `/docs` on the API server.
