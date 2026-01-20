# CVPHOTO AI Headshot Platform - Deployment & Operations Guide

## Table of Contents
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Database Configuration](#database-configuration)
- [Production Deployment](#production-deployment)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### ✅ Environment Variables
- [ ] All required environment variables set in production
- [ ] `ENVIRONMENT` set to `PRODUCTION`
- [ ] Production Stripe keys configured
- [ ] SendGrid API key validated
- [ ] Astria API key active
- [ ] Webhook secret generated and stored securely
- [ ] Supabase credentials verified

### ✅ Security
- [ ] All secrets rotated from development
- [ ] CORS origins configured
- [ ] Rate limiting tested
- [ ] Webhook signature validation enabled
- [ ] SSL/TLS certificates valid

### ✅ Database
- [ ] Indexes created on required fields
- [ ] RLS policies verified
- [ ] Backup schedule confirmed
- [ ] Connection pooling configured

### ✅ External Services
- [ ] Stripe webhook endpoints registered
- [ ] Astria webhook URLs configured
- [ ] SendGrid sender verified
- [ ] DNS records configured

---

## Environment Setup

### Required Environment Variables

```bash
# Core
ENVIRONMENT=PRODUCTION
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_...

# SendGrid
SENDGRID_API_KEY=SG.your-production-key
NOREPLY_EMAIL=noreply@cvphoto.app

# Astria
ASTRIA_API_KEY=your-production-key

# Webhooks
APP_WEBHOOK_SECRET=your-secure-production-secret
```

### Vercel Deployment

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   vercel env add ENVIRONMENT production
   vercel env add STRIPE_SECRET_KEY production
   # ... add all other variables
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

---

## Database Configuration

### Required Indexes

Create these indexes in Supabase for optimal performance:

```sql
-- User table indexes
CREATE INDEX idx_userTable_id ON "userTable"(id);
CREATE INDEX idx_userTable_email ON "userTable"(email);
CREATE INDEX idx_userTable_paymentStatus ON "userTable"("paymentStatus");
CREATE INDEX idx_userTable_workStatus ON "userTable"("workStatus");
CREATE INDEX idx_userTable_created_at ON "userTable"(created_at);
CREATE INDEX idx_userTable_referralCode ON "userTable"("referralCode");

-- Composite indexes for common queries
CREATE INDEX idx_userTable_status_combo ON "userTable"("paymentStatus", "workStatus");
```

### Database Fields to Add

Add these fields to the `userTable` if they don't exist:

```sql
ALTER TABLE "userTable" 
ADD COLUMN IF NOT EXISTS "regenerationCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(8),
ADD COLUMN IF NOT EXISTS "referrals" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "referralRewards" DECIMAL(10,2) DEFAULT 0;
```

### Row Level Security (RLS) Policies

Verify these RLS policies are in place:

```sql
-- Users can only read their own data
CREATE POLICY "Users can read own data" ON "userTable"
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON "userTable"
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything
-- (already configured via service role key)
```

---

## Production Deployment

### Step 1: Build & Test Locally

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Test the production build locally
npm start
```

### Step 2: Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Verify deployment
curl https://your-domain.com/api/health
```

### Step 3: Configure Webhooks

#### Stripe Webhooks
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe-webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`

#### Astria Webhooks
Update your tune/prompt creation calls to include:
```
callback: https://your-domain.com/api/llm/tune-webhook?user_id={userId}&webhook_secret={secret}
```

### Step 4: Verify Deployment

- [ ] Health check responds: `GET /api/health`
- [ ] Analytics loads: `GET /api/analytics`
- [ ] Referral system works: `GET /api/referral`
- [ ] Webhooks process correctly
- [ ] Image uploads succeed
- [ ] Payment flow completes

---

## Monitoring & Logging

### Structured Logging

All logs are in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-20T12:00:00.000Z",
  "level": "INFO",
  "message": "Request completed",
  "requestId": "req_1640000000000_abc123",
  "userId": "user-id",
  "duration": 125
}
```

### Log Levels

- `DEBUG` - Development only (not in production)
- `INFO` - Normal operations
- `WARN` - Warnings (e.g., rate limit approaching)
- `ERROR` - Errors (recoverable)
- `CRITICAL` - Critical errors (require immediate attention)

### Key Metrics to Monitor

1. **API Response Times**
   - Target: < 200ms for most endpoints
   - Alert: > 1000ms

2. **Error Rates**
   - Target: < 1% error rate
   - Alert: > 5% error rate

3. **Webhook Processing**
   - Target: < 5s processing time
   - Alert: Failed webhooks

4. **Database Query Performance**
   - Target: < 100ms per query
   - Alert: > 1s for any query

5. **Rate Limit Hits**
   - Monitor for abuse patterns
   - Alert: Excessive 429 responses

### Setting Up Alerts

**Vercel Logs** (Built-in):
- Go to Vercel Dashboard > Project > Logs
- Set up log drains to external services

**Recommended External Services**:
- Sentry (error tracking)
- Datadog (APM)
- LogDNA (log aggregation)
- Better Stack (uptime monitoring)

---

## Backup & Recovery

### Database Backups

**Supabase Automatic Backups:**
- Daily backups (retained for 7 days on Free tier)
- Point-in-time recovery available on Pro tier

**Verify Backups:**
```bash
# Check latest backup in Supabase Dashboard
# Settings > Database > Backups
```

### Manual Backup

```bash
# Export user data
supabase db dump -f backup_$(date +%Y%m%d).sql

# Backup storage files (if needed)
# Use Supabase Storage API or AWS CLI
```

### Recovery Procedures

#### Database Recovery

1. **Point-in-Time Recovery** (Supabase Pro):
   ```
   Go to Supabase Dashboard > Database > Backups
   Select restore point
   Create new project or restore to existing
   ```

2. **From SQL Dump**:
   ```bash
   supabase db push --db-url <connection-string> --file backup.sql
   ```

#### User Data Recovery

If a user reports lost data:

1. Check webhook logs for their user ID
2. Verify payment status in Stripe
3. Check Astria API for generation status
4. Restore from database backup if needed

### Disaster Recovery Plan

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 24 hours

**Steps:**
1. Identify issue and impact
2. Switch to maintenance mode if needed
3. Restore database from latest backup
4. Verify data integrity
5. Test critical flows
6. Resume normal operations
7. Post-mortem and documentation

---

## Performance Optimization

### Caching Strategy

**In-Memory Cache (Default):**
- User data: 60s TTL
- Analytics: 60s TTL
- Pricing plans: 300s TTL

**Cache Invalidation:**
- User updates automatically invalidate cache
- Manual invalidation available via admin endpoint

### Database Optimization

1. **Query Optimization**
   - Use specific column selection instead of `SELECT *`
   - Leverage indexes for filtered queries
   - Avoid N+1 queries

2. **Connection Pooling**
   - Supabase handles this automatically
   - Monitor connection usage in dashboard

3. **Slow Query Monitoring**
   ```sql
   -- Enable slow query logging
   ALTER DATABASE postgres SET log_min_duration_statement = 1000;
   ```

### Image Optimization

**Next.js Image Component:**
- Automatic WebP/AVIF conversion
- Lazy loading enabled
- Responsive image sizing

**Vercel Image Optimization:**
- Automatically enabled on Vercel
- No additional configuration needed

### CDN Configuration

**Vercel Edge Network:**
- Automatically distributes static assets
- Edge caching for API routes (when configured)

**Custom CDN Headers:**
```javascript
// next.config.mjs
export default {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60' },
        ],
      },
    ];
  },
};
```

---

## Troubleshooting

### Common Issues

#### 1. Webhook Not Processing

**Symptoms:** Tunes complete but status doesn't update

**Diagnosis:**
```bash
# Check webhook logs
grep "webhook" vercel-logs.txt

# Verify webhook secret
echo $APP_WEBHOOK_SECRET
```

**Solutions:**
- Verify webhook URL is correct in Astria
- Check webhook secret matches
- Review idempotency key conflicts
- Check rate limiting

#### 2. Image Upload Failures

**Symptoms:** Upload progress hangs or fails

**Diagnosis:**
```bash
# Check Supabase storage logs
# Check client-side console for errors
```

**Solutions:**
- Verify storage bucket policies
- Check file size limits
- Verify user has authenticated session
- Check network connectivity

#### 3. Payment Flow Errors

**Symptoms:** Stripe checkout fails or doesn't redirect

**Diagnosis:**
```bash
# Check Stripe dashboard for events
# Review application logs for errors
```

**Solutions:**
- Verify Stripe API keys
- Check webhook endpoint registration
- Verify redirect URLs
- Test in Stripe test mode

#### 4. High Database Load

**Symptoms:** Slow query performance

**Diagnosis:**
```sql
-- Check active queries
SELECT * FROM pg_stat_activity 
WHERE state = 'active';
```

**Solutions:**
- Add missing indexes
- Optimize slow queries
- Implement caching
- Upgrade Supabase tier if needed

#### 5. Rate Limit Issues

**Symptoms:** Users getting 429 errors

**Diagnosis:**
```bash
# Check rate limit logs
grep "Rate limit exceeded" vercel-logs.txt
```

**Solutions:**
- Verify rate limit configuration
- Check for abuse patterns
- Increase limits if legitimate usage
- Implement client-side retry logic

### Getting Support

**Logs to Collect:**
1. Request ID from error response
2. User ID (if applicable)
3. Timestamp of issue
4. Error message and stack trace
5. Browser console logs (for frontend issues)

**Support Channels:**
- Supabase: https://supabase.com/support
- Vercel: https://vercel.com/support
- Stripe: https://support.stripe.com

---

## Health Check Monitoring

Use the health check endpoint for uptime monitoring:

```bash
# Basic health check
curl https://your-domain.com/api/health

# Expected response
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "storage": "healthy"
  }
}
```

**Recommended Monitoring Tools:**
- UptimeRobot (free tier available)
- Pingdom
- Better Stack
- StatusCake

**Alert Conditions:**
- Response time > 5s
- Non-200 status code
- Service status = "unhealthy"

---

## Performance Benchmarks

**Target Metrics:**
- Homepage load: < 2s
- API response: < 200ms
- Image upload (15 images): < 30s
- Webhook processing: < 5s
- Database query: < 100ms

**Web Vitals Targets:**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1

---

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Webhook secrets: Every 90 days
   - API keys: Every 6 months
   - Service role keys: Annually

2. **Monitor for Suspicious Activity**
   - Excessive failed logins
   - Unusual API patterns
   - High rate limit hits from single IP

3. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm update
   ```

4. **Review Logs Regularly**
   - Check for ERROR and CRITICAL logs daily
   - Review WARN logs weekly
   - Analyze patterns monthly

---

## Scaling Considerations

### When to Scale

**Database:**
- Query times > 500ms consistently
- Connection pool exhausted
- Storage > 80% of tier limit

**API:**
- Response times > 1s
- Error rate > 2%
- Rate limit hits > 10% of requests

**Storage:**
- Storage usage > 80% of tier
- Bandwidth usage approaching limit

### Scaling Options

1. **Vertical Scaling**
   - Upgrade Supabase tier
   - Increase Vercel function timeout
   - Add more memory to functions

2. **Horizontal Scaling**
   - Deploy to multiple regions
   - Implement read replicas
   - Add CDN for static assets

3. **Code Optimization**
   - Implement more aggressive caching
   - Optimize database queries
   - Reduce payload sizes
   - Lazy load components

---

## Multi-Region Deployment (Future)

**Prerequisites:**
- Database replication setup
- DNS failover configuration
- Cross-region webhook routing

**Regions to Consider:**
- Primary: US East (lowest latency for US users)
- Secondary: EU West (for European users)
- Tertiary: Asia Pacific (for Asian users)

**Implementation Steps:**
1. Set up database read replicas in target regions
2. Deploy application to multiple Vercel regions
3. Configure geo-routing in DNS
4. Update webhook URLs for region-specific endpoints
5. Test failover procedures

---

## Maintenance Windows

**Recommended Schedule:**
- Weekly: Off-peak hours (2-4 AM PST)
- Duration: < 30 minutes
- Notification: 48 hours advance notice

**Maintenance Tasks:**
- Database index rebuilding
- Secret rotation
- Dependency updates
- Performance optimization
- Log cleanup

---

## Contact & Support

**Technical Issues:**
- Create GitHub issue
- Email: support@cvphoto.app
- Include: Request ID, timestamp, error details

**Emergency Contact:**
- Critical system failures only
- Emergency email: emergency@cvphoto.app
- Response SLA: 1 hour
