# Deployment Guide

## Static Hosting Options

### Vercel (Recommended)
- **Pros**: Excellent PWA support, automatic HTTPS, edge functions
- **Cons**: Limited to static hosting, no server-side processing
- **Configuration**: Zero-config deployment with Vite

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "web/dist",
  "framework": "vite",
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache"
        }
      ]
    }
  ]
}
```

### Netlify
- **Pros**: Great PWA support, form handling, edge functions
- **Cons**: Build time limits, less flexible than Vercel
- **Configuration**: Netlify.toml for build settings

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "web/dist"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### GitHub Pages
- **Pros**: Free, integrated with GitHub, simple setup
- **Cons**: No server-side features, limited to public repos
- **Configuration**: GitHub Actions for automated deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web/dist
```

## PWA Configuration

### Manifest File
```json
// public/manifest.webmanifest
{
  "name": "Snap Saver",
  "short_name": "SnapSaver",
  "description": "Save your Snapchat memories before they're deleted",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "en",
  "dir": "ltr"
}
```

### Service Worker
```typescript
// src/sw/service-worker.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Cache API responses with stale-while-revalidate
registerRoute(
  ({ url }) => url.origin === self.location.origin,
  new StaleWhileRevalidate()
);

// Handle offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
```

## Build Configuration

### Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.snapchat\.com\/dmd\/mm/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snapchat-downloads',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Snap Saver',
        short_name: 'SnapSaver',
        description: 'Save your Snapchat memories before they\'re deleted',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          workers: ['fflate'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
```

## Environment Configuration

### Development
```bash
# .env.development
VITE_APP_NAME=Snap Saver (Dev)
VITE_APP_VERSION=1.0.0-dev
VITE_DEBUG=true
```

### Production
```bash
# .env.production
VITE_APP_NAME=Snap Saver
VITE_APP_VERSION=1.0.0
VITE_DEBUG=false
```

## Versioning Strategy

### Semantic Versioning
- **Major**: Breaking changes to API or file format
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, performance improvements

### Release Process
1. **Development**: Feature branches, PR reviews
2. **Staging**: Deploy to staging environment for testing
3. **Production**: Deploy to production with rollback plan
4. **Monitoring**: Track errors, performance, user feedback

### Changelog
```markdown
# CHANGELOG.md
## [1.0.0] - 2024-01-15
### Added
- Initial release with ZIP parsing and export functionality
- PWA support with offline capabilities
- File System Access API integration

### Changed
- Improved error handling and user feedback
- Enhanced progress tracking with ETA

### Fixed
- Memory leaks during large file processing
- CORS issues with Snapchat download URLs
```

## Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
npm run build
npm run analyze

# Lighthouse audit
npm run lighthouse
```

### Optimization Targets
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **First Input Delay**: <100ms
- **Bundle Size**: <500KB gzipped

### Caching Strategy
- **Static Assets**: Cache for 1 year
- **HTML**: Cache for 1 hour
- **Service Worker**: No cache
- **API Responses**: Cache for 7 days

## Security Headers

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://www.snapchat.com;">
```

### Security Headers (Vercel)
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

## Monitoring & Analytics

### Error Tracking
```typescript
// src/lib/errorTracking.ts
export function trackError(error: Error, context?: string) {
  if (import.meta.env.PROD) {
    // Send to error tracking service
    console.error('Error:', error, 'Context:', context);
  }
}
```

### Performance Monitoring
```typescript
// src/lib/performance.ts
export function trackPerformance(name: string, startTime: number) {
  const duration = performance.now() - startTime;
  
  if (import.meta.env.PROD) {
    // Send to analytics service
    console.log(`Performance: ${name} took ${duration}ms`);
  }
}
```

### User Analytics (Optional)
```typescript
// src/lib/analytics.ts
export function trackEvent(event: string, properties?: Record<string, any>) {
  if (import.meta.env.PROD && userConsent) {
    // Send to analytics service
    console.log('Event:', event, properties);
  }
}
```

## Rollback Strategy

### Automated Rollback
- **Health Checks**: Monitor error rates and response times
- **Automatic Rollback**: Trigger rollback if error rate >5%
- **Manual Override**: Ability to manually trigger rollback

### Rollback Process
1. **Detect Issue**: Monitor error rates, user feedback
2. **Assess Impact**: Determine severity and affected users
3. **Execute Rollback**: Deploy previous version
4. **Verify Fix**: Confirm issue is resolved
5. **Post-Mortem**: Analyze root cause and prevention

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Build successful
- [ ] Lighthouse audit passing
- [ ] Security scan clean
- [ ] Performance benchmarks met

### Deployment
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Verify PWA functionality

### Post-Deployment
- [ ] Monitor performance metrics
- [ ] Check error tracking
- [ ] Verify user feedback
- [ ] Update documentation
- [ ] Announce release
