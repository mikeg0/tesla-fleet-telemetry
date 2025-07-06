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

## 3 – Production Build & Deployment

1. `npm run build` – emits static files in `frontend/dist/`.
2. **S3**
   ```bash
   aws s3 sync dist/ s3://$WEB_BUCKET --delete
   ```
3. **CloudFront** – invalidate the cache so users see the latest bundle:
   ```bash
   aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/*"
   ```

### Using AWS Amplify (optional, zero-ops)

```bash
amplify init               # follow prompts – choose *Hosting: AWS Amplify*
amplify add hosting
amplify publish            # pushes build to S3 & updates CloudFront
```

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