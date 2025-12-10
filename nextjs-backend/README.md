# Teleprompter Backend (Next.js on Vercel)

This Next.js application provides JWT token generation for the Teleprompter WebSocket bridge.

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Generate a JWT secret**:

   ```bash
   openssl rand -base64 32
   ```

3. **Create `.env.local`**:

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` and add your generated secret:

   ```
   REALTIME_JWT_SECRET=your-generated-secret-here
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```
   The server will start at http://localhost:3000

## API Endpoints

### `GET /api/token`

Generates a short-lived JWT token (5 minutes) for WebSocket authentication.

**Response**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 300
}
```

## Deployment to Vercel

1. **Install Vercel CLI** (if not already installed):

   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy**:

   ```bash
   vercel
   ```

   Follow the prompts to link to your Vercel account.

4. **Set environment variable in Vercel**:

   ```bash
   vercel env add REALTIME_JWT_SECRET
   ```

   Paste your JWT secret when prompted.

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

## Security Notes

- The JWT secret (`REALTIME_JWT_SECRET`) must be shared between this service and the Render WebSocket bridge
- Tokens expire after 5 minutes for security
- CORS is enabled for Framer to access the API
- Consider adding rate limiting in production
- Consider adding user authentication before issuing tokens

## Next Steps

After deploying this backend:

1. Note your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Set up the Render WebSocket bridge with the same JWT secret
3. Update the Framer component to fetch tokens from this endpoint
