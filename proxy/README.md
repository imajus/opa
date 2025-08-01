# 1inch API Proxy - Cloudflare Worker

A Cloudflare Worker that acts as a proxy for the 1inch API, adding authentication headers and CORS protection.

## Features

- Proxies all requests to `https://api.1inch.dev/`
- Automatically adds `Authorization: Bearer` header using environment variable
- Enforces CORS protection based on allowed origin
- Supports all HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
- Preserves full URL path and request body

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

**For deployment (production):**

- Set sensitive variables like API tokens as secrets:

```bash
npx wrangler secret put API_AUTH_TOKEN
```

- Configure non-sensitive variables in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://yourdomain.com"
```

**For local development:**

- Create a `.dev.vars` file with your actual values:

```
API_AUTH_TOKEN=your-actual-1inch-api-token
ALLOWED_ORIGIN=http://localhost:3000
```

## Development

Start local development server:

```bash
npm run dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Usage

Once deployed, your worker will be available at your Cloudflare Workers URL. All requests to your worker will be proxied to the 1inch API.

### Example Requests

**Get token list:**

```bash
curl -X GET "https://your-worker.your-subdomain.workers.dev/v5.2/1/tokens"
```

**Get quote:**

```bash
curl -X GET "https://your-worker.your-subdomain.workers.dev/v5.2/1/quote?fromTokenAddress=0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C&toTokenAddress=0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984&amount=1000000000000000000"
```

**Swap tokens:**

```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/v5.2/1/swap" \
  -H "Content-Type: application/json" \
  -d '{
    "fromTokenAddress": "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8C",
    "toTokenAddress": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "amount": "1000000000000000000",
    "fromAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "slippage": 1
  }'
```

## Environment Variables

- `API_AUTH_TOKEN`: Your 1inch API authentication token (set as secret for production)
- `ALLOWED_ORIGIN`: The origin domain that's allowed to make requests (e.g., `https://yourdomain.com`)

### Managing Secrets

For production deployments, use Wrangler's secret management to securely store sensitive values:

```bash
# Set API token as a secret (will prompt for the value)
npx wrangler secret put API_AUTH_TOKEN

# List all secrets
npx wrangler secret list

# Remove a secret if needed
npx wrangler secret delete API_AUTH_TOKEN
```

## Security

- Only requests from the specified `ALLOWED_ORIGIN` are accepted
- The API token is automatically added to all requests
- CORS headers are properly configured for browser requests

## Error Handling

- Returns 403 Forbidden for requests from unauthorized origins
- Returns 500 Internal Server Error for proxy failures
- Preserves original response status codes from the 1inch API
