# CVPHOTO AI Headshot Platform - API Documentation (Enterprise Edition)

## Table of Contents
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Request Tracing](#request-tracing)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Analytics](#analytics)
  - [Regenerate](#regenerate)
  - [Referrals](#referrals)
  - [Webhooks](#webhooks)
- [Image Optimization](#image-optimization)
- [Webhook Security](#webhook-security)
- [Request Logging](#request-logging)
- [Circuit Breaker Status](#circuit-breaker-status)
- [Best Practices](#best-practices)
- [Support](#support)

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

The API implements comprehensive rate limiting to prevent abuse:

- **Authenticated Users:** 100 requests/hour per user
- **IP-based:** 1000 requests/hour per IP address
- **Astria API Calls:** 10 concurrent tune jobs per user
- **Payment API:** 10 requests/hour per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000000
Retry-After: 3600
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600,
  "requestId": "req_1640000000000_abc123"
}
```

## Request Tracing

All API requests include request tracing for debugging and support:

**Request Headers:**
- `X-Request-ID`: Unique request identifier (automatically generated)

**Response Headers:**
- `X-Request-ID`: Same request ID for correlation
- `X-Response-Time`: Processing time in milliseconds

**Usage:**
- Include `X-Request-ID` in all support requests
- Use for debugging and tracing across services
- Enables end-to-end request tracking

**Example:**
```
Request: GET /api/analytics
Headers: X-Request-ID: req_1640000000000_abc123

Response: 200 OK
Headers: 
  X-Request-ID: req_1640000000000_abc123
  X-Response-Time: 125

---

## Error Handling

### Standard Error Response Format

All errors include request tracing and detailed context:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific error details",
    "suggestion": "how to fix the issue"
  },
  "requestId": "req_1640000000000_abc123",
  "timestamp": "2024-01-20T12:00:00.000Z"
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

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `AUTH_REQUIRED` | Authentication required | Provide valid session cookie |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry with exponential backoff |
| `INVALID_INPUT` | Validation failed | Check request format and constraints |
| `PAYMENT_FAILED` | Payment processing failed | Verify payment details and retry |
| `UPLOAD_FAILED` | Image upload failed | Check file format, size, and dimensions |
| `CIRCUIT_BREAKER_OPEN` | Service temporarily unavailable | Retry after delay (see Retry-After header) |
| `TIMEOUT` | Request timed out | Check network connection and retry |
| `IDempotency-Key-Conflict` | Duplicate request | Use unique idempotency keys |

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

## Image Optimization

The platform provides comprehensive image optimization for better performance and user experience.

### Image Optimization API

**GET** `/api/optimize`

Generate optimized image URLs for CDN delivery.

**Query Parameters:**
- `url`: Original image URL (required, URL-encoded)
- `width`: Target width in pixels
- `height`: Target height in pixels  
- `quality`: Quality (1-100, default: 85)
- `format`: Format (webp, avif, jpeg, png, auto - default: auto)
- `fit`: Fit mode (cover, contain, fill, inside, outside - default: cover)
- `position`: Position (center, top, right, bottom, left, faces - default: center)

**Response:**
```json
{
  "optimizedUrl": "https://cdn.cvphoto.app/optimize?url=encoded_url&width=800&format=webp",
  "originalUrl": "original_url",
  "savings": "65%",
  "format": "webp",
  "dimensions": {"width": 800, "height": 800}
}
```

### Responsive Image SrcSet

**GET** `/api/optimize/srcset`

Generate responsive image srcset for different screen sizes.

**Query Parameters:**
- `url`: Original image URL (required, URL-encoded)
- `sizes`: Comma-separated sizes (default: 300,600,1200,2400)
- `format`: Format (default: auto)
- `quality`: Quality (default: 85)

**Response:**
```json
{
  "srcSet": "https://cdn.cvphoto.app/optimize?url=...&width=300 300w, https://cdn.cvphoto.app/optimize?url=...&width=600 600w",
  "sizes": "(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px",
  "aspectRatio": "1:1",
  "formats": ["webp", "avif"]
}
```

### Optimization Features

- **Automatic Format Selection**: Chooses best format based on browser support
- **Responsive Images**: Generates multiple sizes for different devices
- **Quality Optimization**: Adjusts quality based on device type
- **CDN Delivery**: Fast global delivery through optimized CDN
- **Lazy Loading**: Built-in support for lazy loading

### Format Support Matrix

| Format | Browser Support | Compression | Quality | Use Case |
|--------|----------------|-------------|---------|----------|
| AVIF | Chrome 85+, Edge 85+, Firefox 93+ | Best | Excellent | Modern browsers, high quality |
| WebP | All modern browsers | Excellent | Very Good | General use, good balance |
| JPEG | Universal | Good | Good | Fallback, compatibility |
| PNG | Universal | Moderate | Lossless | Transparency required |

### Optimization Presets

```json
{
  "thumbnail": {"width": 300, "height": 300, "quality": 75, "format": "webp"},
  "preview": {"width": 800, "height": 800, "quality": 80, "format": "webp"},
  "full": {"width": 2000, "height": 2000, "quality": 90, "format": "webp"},
  "print": {"width": 3000, "height": 3000, "quality": 95, "format": "png"}
}
```

---

## Circuit Breaker Status

Monitor the status of external service integrations.

### Health Check with Circuit Breaker Status

**GET** `/api/health`

**Response includes circuit breaker status:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "services": {
    "database": "healthy",
    "storage": "healthy"
  },
  "circuitBreakers": {
    "astria": {
      "state": "CLOSED",
      "failureCount": 0,
      "nextAttempt": null
    },
    "stripe": {
      "state": "CLOSED",
      "failureCount": 0,
      "nextAttempt": null
    },
    "sendgrid": {
      "state": "CLOSED",
      "failureCount": 0,
      "nextAttempt": null
    }
  },
  "version": "2.0.0"
}
```

### Circuit Breaker States

- **CLOSED**: Normal operation
- **HALF_OPEN**: Testing after failure period
- **OPEN**: Service unavailable, requests rejected

### Failure Thresholds

- **Astria API**: 5 failures, 5 minute reset
- **Stripe API**: 3 failures, 3 minute reset
- **SendGrid API**: 4 failures, 4 minute reset

---

## Webhook Security

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

### General Best Practices

1. **Always handle rate limit responses** - Implement exponential backoff with jitter
2. **Store and use request IDs** - Include in all support requests for debugging
3. **Implement timeout handling** - Use 30-60 second timeouts for external calls
4. **Cache responses when appropriate** - Respect Cache-Control headers
5. **Validate input client-side** - Use Zod schemas for validation
6. **Handle all error cases** - Provide user-friendly messages

### Enterprise-Specific Best Practices

7. **Use request tracing** - Correlate requests across services using X-Request-ID
8. **Implement circuit breaker patterns** - Handle service failures gracefully
9. **Use chunked uploads** - For large files (>5MB) with pause/resume support
10. **Leverage image optimization** - Use CDN-optimized URLs for better performance
11. **Monitor circuit breaker status** - Check /health endpoint regularly
12. **Use idempotency keys** - For all state-changing operations

### Performance Optimization

```javascript
// Example: Using optimized images
const optimizedUrl = await fetch(`/api/optimize?url=${encodeURIComponent(originalUrl)}&width=800&format=auto`);

// Example: Handling rate limits
async function makeApiCall() {
  try {
    const response = await fetch('/api/endpoint', {
      headers: {
        'X-Request-ID': generateRequestId()
      }
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeApiCall(); // Retry
    }
    
    return await response.json();
  } catch (error) {
    // Implement circuit breaker logic
    if (error.message.includes('CIRCUIT_BREAKER_OPEN')) {
      // Fallback to cached data or alternative service
    }
  }
}
```

### Error Handling Patterns

```javascript
// Comprehensive error handling example
async function handleApiError(error, requestId) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    const retryAfter = error.retryAfter || 60;
    showUserMessage(`Too many requests. Please wait ${retryAfter} seconds.`);
    return; // Don't retry immediately
  }
  
  if (error.code === 'CIRCUIT_BREAKER_OPEN') {
    showUserMessage('Service temporarily unavailable. Please try again later.');
    // Implement fallback behavior
    return;
  }
  
  if (error.code === 'AUTH_REQUIRED') {
    redirectToLogin();
    return;
  }
  
  // Log error with request ID for support
  logError({ error, requestId });
  showUserMessage('An error occurred. Please try again.');
}
```

### Security Best Practices

1. **Always validate webhook signatures** - Prevent replay attacks
2. **Use HTTPS for all requests** - Never use HTTP in production
3. **Sanitize all user input** - Prevent XSS and injection attacks
4. **Implement CSRF protection** - For state-changing endpoints
5. **Use secure cookies** - With HttpOnly, Secure, and SameSite attributes
6. **Monitor for suspicious activity** - Rate limiting and anomaly detection

---

## Support

For API support or to report issues:
- **Email**: support@cvphoto.app
- **Priority Support** (Enterprise customers): enterprise-support@cvphoto.app
- **Include in all requests**: Request ID, User ID, Timestamp

### Support Response Times

- **Standard Support**: 24-48 hours response
- **Enterprise Support**: 4-8 hours response (business hours)
- **Critical Issues**: Immediate escalation for production outages

### Required Information for Support

```json
{
  "requestId": "req_1640000000000_abc123",
  "userId": "user_12345",
  "endpoint": "/api/analytics",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "errorMessage": "Too many requests",
  "browser": "Chrome 120",
  "os": "Mac OS X",
  "stepsToReproduce": ["1. Log in", "2. Navigate to analytics", "3. Error occurs"]
}
```

### Enterprise Support Features

- **Dedicated Account Manager**
- **SLA Guarantees** (99.9% uptime)
- **Priority Bug Fixes**
- **Custom Integration Support**
- **Quarterly Performance Reviews**
- **Advanced Monitoring & Alerting**

### Status Page

Check system status at: https://status.cvphoto.app

- Real-time incident reporting
- Historical uptime statistics
- Maintenance schedule
- Subscription for notifications

### API Versioning

- **Current Version**: v2.0 (Enterprise Edition)
- **Deprecation Policy**: 6 months notice for breaking changes
- **Version Headers**: `X-API-Version: 2.0`

### Migration Guides

- **v1.0 → v2.0**: [Migration Guide](/docs/MIGRATION_v1_to_v2.md)
- **Breaking Changes**: Documented with deprecation warnings
- **Backward Compatibility**: Maintained for 12 months
