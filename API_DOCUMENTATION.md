# CVPHOTO AI Headshot Platform - API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Analytics](#analytics)
  - [Regenerate](#regenerate)
  - [Referrals](#referrals)
  - [Webhooks](#webhooks)

---

## Authentication

All protected endpoints require authentication via Supabase session cookies. Users must be logged in with a valid session.

**Headers:**
```
Cookie: sb-<project>-auth-token=<token>
```

**Unauthorized Response (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authenticated Users:** 100 requests/hour per user
- **IP-based:** 1000 requests/hour per IP address
- **Astria API Calls:** 10 concurrent tune jobs per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000000
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Endpoints

### Health Check

Check the health status of the API and its dependencies.

**Endpoint:** `GET /api/health`

**Authentication:** None

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "services": {
    "database": "healthy",
    "storage": "healthy"
  },
  "version": "1.0.0"
}
```

**Degraded Response (503):**
```json
{
  "status": "degraded",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "services": {
    "database": "healthy",
    "storage": "unhealthy"
  },
  "version": "1.0.0"
}
```

---

### Analytics

Retrieve user analytics and usage statistics.

**Endpoint:** `GET /api/analytics`

**Authentication:** Required

**Query Parameters:** None

**Response (200):**
```json
{
  "totalImages": 45,
  "imagesByPlan": {
    "professional": 45
  },
  "generationTimeline": [
    {
      "date": "2024-01-20T10:00:00.000Z",
      "count": 4
    }
  ],
  "creditsUsed": 5,
  "creditsAvailable": 95,
  "averageGenerationTime": 0,
  "downloadCount": 12,
  "planType": "professional"
}
```

**Caching:** Results are cached for 60 seconds

---

### Regenerate

Queue a regeneration request for existing prompts with new styles.

**Endpoint:** `POST /api/regenerate`

**Authentication:** Required

**Rate Limit:** User-based (100 req/hour)

**Request Body:**
```json
{
  "promptIds": [1, 2, 3],
  "styleOverrides": [
    {
      "clothing": "Navy blue suit",
      "background": "Office"
    }
  ],
  "customPrompt": "Professional headshot with natural lighting"
}
```

**Validation Rules:**
- `promptIds`: Array of 1-10 numbers
- `styleOverrides`: Optional array of style objects
- `customPrompt`: Optional string, max 500 characters

**Response (200):**
```json
{
  "message": "Regeneration queued successfully",
  "requestId": "req_1640000000000_abc123",
  "remaining": 4
}
```

**Limit Exceeded Response (403):**
```json
{
  "error": "Regeneration limit exceeded for your plan"
}
```

**Plan Limits:**
- Basic: 5 regenerations
- Professional: 50 regenerations
- Executive: 100 regenerations

---

### Referrals

#### Get Referral Data

Retrieve user's referral code and referral history.

**Endpoint:** `GET /api/referral`

**Authentication:** Required

**Response (200):**
```json
{
  "referralCode": "ABC12345",
  "referrals": [
    {
      "userId": "user-id",
      "email": "friend@example.com",
      "signupDate": "2024-01-20T10:00:00.000Z",
      "status": "pending"
    }
  ],
  "totalRewards": 15
}
```

#### Apply Referral Code

Apply a referral code for a new user signup.

**Endpoint:** `POST /api/referral`

**Authentication:** Required

**Request Body:**
```json
{
  "referredCode": "ABC12345"
}
```

**Response (200):**
```json
{
  "message": "Referral applied successfully",
  "reward": 5
}
```

**Error Responses:**
- `400` - Invalid or own referral code
- `404` - Referral code not found

**Reward Structure:**
- Basic Plan: $5 per referral
- Professional Plan: $7 per referral
- Executive Plan: $10 per referral

---

### Webhooks

#### Tune Webhook

Callback endpoint for Astria tune completion.

**Endpoint:** `POST /api/llm/tune-webhook?user_id={userId}&webhook_secret={secret}`

**Authentication:** Webhook secret validation

**Request Body:**
```json
{
  "tune": {
    "id": 1234567,
    "title": "user-id",
    "name": "cat",
    "created_at": "2024-01-20T10:00:00.000Z",
    "updated_at": "2024-01-20T10:30:00.000Z"
  }
}
```

**Response (200):**
```json
{
  "message": "Webhook processed successfully",
  "userId": "user-id"
}
```

**Features:**
- Automatic retry with exponential backoff (3 attempts)
- Idempotency key validation
- Request timeout (60 seconds)
- Comprehensive logging

#### Prompt Webhook

Callback endpoint for Astria prompt completion.

**Endpoint:** `POST /api/llm/prompt-webhook?user_id={userId}&webhook_secret={secret}`

**Authentication:** Webhook secret validation

**Request Body:**
```json
{
  "prompt": {
    "id": 18609859,
    "text": "<lora:1661944:1.0>ohwx man in professional attire",
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "tune_id": 1504944,
    "created_at": "2024-01-20T10:00:00.000Z",
    "trained_at": "2024-01-20T10:30:00.000Z"
  }
}
```

**Response (200):**
```json
{
  "message": "Webhook processed successfully",
  "userId": "user-id"
}
```

**Plan Prompt Limits:**
- Basic: 10 prompts
- Professional: 100 prompts
- Executive: 200 prompts

**Limit Exceeded Response (403):**
```json
{
  "error": "Prompt limit exceeded for plan"
}
```

---

## Webhook Security

All webhooks must include:
1. `webhook_secret` query parameter matching `APP_WEBHOOK_SECRET`
2. `user_id` query parameter for user identification

**Security Features:**
- Secret key validation
- Idempotency protection (24-hour window)
- Request logging with correlation IDs
- Automatic retry on failure

---

## Request Logging

All API requests are logged with:
- Request ID (correlation tracking)
- User ID (if authenticated)
- Timestamp
- Duration
- Status code
- Error details (if applicable)

**Log Format (JSON):**
```json
{
  "timestamp": "2024-01-20T12:00:00.000Z",
  "level": "INFO",
  "message": "Request completed",
  "requestId": "req_1640000000000_abc123",
  "userId": "user-id",
  "duration": 125,
  "status": 200
}
```

---

## Best Practices

1. **Always handle rate limit responses** - Implement exponential backoff
2. **Store and use request IDs** - For debugging and support
3. **Implement timeout handling** - Don't wait indefinitely
4. **Cache responses when appropriate** - Reduce API load
5. **Validate input client-side** - Before making API calls
6. **Handle all error cases** - Provide user-friendly messages

---

## Support

For API support or to report issues:
- Email: support@cvphoto.app
- Include request ID in all support requests
