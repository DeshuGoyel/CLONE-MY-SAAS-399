# CVPHOTO - Enterprise AI Headshot Platform

Full codebase with custom FLUX API. Live App on: www.cvphoto.app

This repo was forked on 30th of November, 2024 and has all the code from CVPHoto.app. It is being supported and updated by @johnnytran for customers 
that bought the codebase of CVPhoto.app via clonemysaas.com.

Star this repo to be notified with new updates and upcoming features.

## 🚀 Latest Update: Enterprise Enhancements

**Version 2.0** brings comprehensive enterprise-grade improvements:

- ✅ **Performance**: Caching, database indexing, query optimization
- ✅ **New Features**: Analytics dashboard, referral program, regeneration system
- ✅ **Security**: Rate limiting, webhook validation, security headers
- ✅ **Reliability**: Retry logic, idempotency, comprehensive error handling
- ✅ **Monitoring**: Structured logging, health checks, performance tracking
- ✅ **Production Ready**: Multi-region prep, CDN optimization, backup procedures

📖 **[View Complete Enhancement Details →](ENTERPRISE_ENHANCEMENTS.md)**

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Initial setup and configuration |
| [ENTERPRISE_ENHANCEMENTS.md](ENTERPRISE_ENHANCEMENTS.md) | Complete list of v2.0 enhancements |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Comprehensive API reference |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Production deployment and operations |
| [supabase/README.md](supabase/README.md) | Database configuration |

## Get started

1. Follow the [Get Started Tutorial](https://www.clonemysaas.com/docs) to clone the repo and run your local server.

### Local development (quick start)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000.

### Full Setup Instructions

For complete setup instructions including:
- Supabase database and storage configuration
- Environment variable configuration
- Automated cleanup setup
- Database migration (v2.0)

See the [SETUP_GUIDE.md](SETUP_GUIDE.md) and [supabase/README.md](supabase/README.md) for detailed step-by-step instructions.

### Database Migration (v2.0)

After setting up, run the enterprise enhancements migration:

```bash
# Using Supabase CLI
supabase db push

# Or run directly in Supabase Dashboard SQL Editor:
# supabase/migrations/20240120_enterprise_enhancements.sql
```

## 🎯 Key Features

### Core Features
- AI headshot generation with Astria/FLUX
- Multiple plan tiers (Basic, Professional, Executive)
- Stripe payment integration
- SendGrid email notifications
- Supabase authentication and storage

### New in v2.0
- 📊 Analytics dashboard with usage metrics
- 🔗 Referral program with rewards tracking
- 🔄 Image regeneration system
- 🚀 Performance optimizations (caching, indexes)
- 🔒 Enhanced security (rate limiting, validation)
- 📝 Structured logging and monitoring
- 💪 Webhook reliability improvements

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS (shadcn/ui)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Payments**: Stripe
- **Email**: SendGrid
- **AI**: Astria/FLUX API
- **Deployment**: Vercel

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/analytics` | GET | User analytics data |
| `/api/regenerate` | POST | Regenerate images |
| `/api/referral` | GET/POST | Referral system |
| `/api/llm/tune-webhook` | POST | Astria tune callback |
| `/api/llm/prompt-webhook` | POST | Astria prompt callback |

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.

## 🔐 Security Features

- Rate limiting (100 req/hr per user, 1000 req/hr per IP)
- Webhook signature validation
- Input validation with Zod schemas
- Security headers (CSP, HSTS, X-Frame-Options)
- SQL injection prevention
- Authentication on all protected routes

## 📈 Performance Optimizations

- In-memory caching (60s TTL)
- Database indexes on key fields
- Optimized database queries
- CDN integration for images
- Automatic image optimization (WebP, AVIF)
- Response compression

## 🎯 Production Checklist

Before deploying to production:

- [ ] Run database migration
- [ ] Set all environment variables
- [ ] Configure Stripe webhooks
- [ ] Set up Astria webhooks
- [ ] Verify email sending
- [ ] Test payment flow
- [ ] Enable monitoring
- [ ] Configure backups

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed checklist.

## 🆘 Support

PIN code to documentation: JT24

For issues or questions:
1. Check documentation files
2. Review logs with request ID
3. Check `/api/health` endpoint
4. Contact support with detailed information

## ⚠️ License & Usage

Any illegal distribution or bad behaviour will be banned from this repo and you will not receive: 1) Upcoming features. 2) No shoutout from my Twitter account when you launch. 3) Lose access to this repo permanently.

---

**Version**: 2.0.0 - Enterprise Ready 🚀
**Last Updated**: January 2024
