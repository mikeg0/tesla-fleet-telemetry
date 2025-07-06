# Tesla Fleet Telemetry – Frontend (Single Page Application)

This directory houses the **stand-alone front-end** for Tesla-Fleet-Telemetry.  It is designed to be deployed to **Amazon S3 + CloudFront** (or AWS Amplify Hosting) so UI releases can ship independently from the Go back-end.

---

## 1 – Project Layout

```
frontend/
├── README.md              # this file
├── package.json           # NPM dependencies & scripts
├── tsconfig.json          # TypeScript compiler options
├── vite.config.ts         # Vite build config (React + TS)
├── index.html             # SPA entry (handled by Vite)
├── .env.example           # copy → .env with your own values
└── src/
    ├── main.tsx           # React entry, mounts <App/>
    ├── App.tsx            # Router + protected routes
    ├── AuthProvider.tsx   # Cognito / Tesla OAuth context
    ├── components/
    │   └── MapView.tsx    # Amazon Location Service map wrapper
    └── pages/
        ├── Login.tsx
        ├── Home.tsx
        └── Account.tsx
```

*Why Vite?*  It gives lightning-fast local dev & tiny production bundles and is the AWS Amplify default.

---

## 2 – Local Development

```bash
cd frontend
cp .env.example .env                 # fill in AWS & Cognito details
npm install                          # one-time
npm run dev                          # http://localhost:5173
```

*Hot-reload* edits instantly.  The SPA calls the back-end at `https://<api-gateway-id>.execute-api.<region>.amazonaws.com/` – set this URL as `VITE_API_URL` once the API is live.

---

## 3 – Production Build & Deployment (S3 + CloudFront)

### 3.1 One-time setup

1. **Create S3 bucket** (static website hosting _disabled_):
   ```bash
   WEB_BUCKET=tft-frontend-$AWS_ACCOUNT_ID
   aws s3 mb s3://$WEB_BUCKET
   aws s3api put-public-access-block \
     --bucket $WEB_BUCKET \
     --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false'
   ```
2. **Upload an initial `index.html`** so CloudFront origin check passes:
   ```bash
   echo '<!doctype html><title>Deploying…</title>' | aws s3 cp - s3://$WEB_BUCKET/index.html
   ```
3. **Create CloudFront distribution**:
   ```bash
   CF_ID=$(aws cloudfront create-distribution \
     --origin-domain-name $WEB_BUCKET.s3.amazonaws.com \
     --default-root-object index.html \
     --query 'Distribution.Id' --output text)
   DNS=$(aws cloudfront get-distribution --id $CF_ID --query 'Distribution.DomainName' --output text)
   ```
4. (Optional) **Route 53**: point `app.example.com` → CNAME → `$DNS`.

### 3.2 CI/CD steps (each commit)

```bash
npm ci                      # reproducible install
npm run build               # outputs dist/
aws s3 sync dist/ s3://$WEB_BUCKET --delete
aws cloudfront create-invalidation --distribution-id $CF_ID --paths '/*'
```

> Tip: Wrap the above into a GitHub Actions workflow using OIDC-based AWS auth.

### 3.3 Zero-downtime deploys
* Upload to `dist-<commitSHA>/` first, test with `?v=sha`, then flip CloudFront origin-path.

---

## 4 – Environment Variables (`.env`)

```
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=tft.auth.us-east-1.amazoncognito.com
VITE_MAP_STYLE_URL=https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/ExampleMap/style-descriptor
VITE_API_URL=https://api.example.com      # back-end base URL (optional for prod)
```

>  **Do not commit your real `.env`!**  Keep secrets out of source control.

---

## 5 – Roadmap / Future Plans

| Milestone | Description |
|-----------|-------------|
| ① Vehicle list           | Display authorised vehicles & live status |
| ② Real-time telemetry    | WebSocket stream overlayed on the map |
| ③ Historical playback    | Scrub-bar to replay routes from S3-stored parquet |
| ④ Alerts & notifications | Surface vehicle errors / alerts via toast + push |
| ⑤ Subscription & billing | Integrate Stripe Checkout / AWS Marketplace |
| ⑥ PWA offline support    | Service Worker for cached map tiles & last-known data |

Contributions welcome – open a PR or issue!  When the UI matures, this folder will graduate into a **separate repo** for even faster iterations.

---

## 6 – Expanded Roadmap

| Phase | Feature | Notes |
|-------|---------|-------|
| MVP | Tesla OAuth + vehicle list | DONE ✅ |
| 1 | Real-time telemetry overlay | WebSocket, markers update colour/heading |
| 2 | Historical playback | Range slider + S3 👉 Athena |
| 3 | Alerts dashboard | Vehicle errors, push notifications |
| 4 | Fleet-wide analytics | Charts (energy, mileage), multi-vehicle selection |
| 5 | Subscription & billing | Stripe or AWS Marketplace integration |
| 6 | Offline/PWA | ServiceWorker, cached map tiles |
| 7 | Native mobile wrapper | Capacitor / React Native |

Each phase can ship independently once the back-end surface area exists.