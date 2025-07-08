# Tesla-Fleet-Telemetry – AWS Deployment Guide

## Objective
Deploy the existing Go-based telemetry backend so that it powers a public web service where:
• End-users sign-in with Tesla OAuth.
• A dashboard shows every vehicle a user has authorised (map position, charge-state, media, door-state …).
• The architecture is **simple**, **low-maintenance**, and **cost-effective**, yet able to evolve (account management, billing, extra micro-services).

---

## 1. High-level Architecture

```
┌────────┐        Tesla OAuth        ┌────────────┐
│Client  │  ───────────────────────▶ │ Cognito    │ (federated with Tesla)
└────────┘                           └────────────┘
     │ REST / WebSocket                     ▲
     ▼                                      │ JWT
┌────────────────────────────────────────────────────────────┐
│ Amazon API Gateway (HTTP+WebSocket)                       │
└────────────────────────────────────────────────────────────┘
     │ Lambda proxy (Go) / Fargate service (Go)             
     ▼
┌───────────────────────┐      ┌───────────────────────────┐
│ Telemetry Producer    │──▶──▶│ Amazon Kinesis Data Stream│
└───────────────────────┘      └───────────────────────────┘
                                    │  Firehose             
                                    ▼
                       ┌───────────────────────────┐
                       │ Amazon S3 (raw parquet)   │
                       └───────────────────────────┘
                                    ▲ (async)    ▼ (sync)
            ┌────────────────────────┴──────┐ ┌───────────────┐
            │ DynamoDB (Users, Vehicles)    │ │ ElastiCache   │
            └───────────────────────────────┘ └───────────────┘
                                    ▲                       
                                    │                       
                       ┌───────────────────────────┐
                       │ Amazon Location Service   │ (maps)
                       └───────────────────────────┘
```

Key points:
1. **Serverless first** (API Gateway, Lambda, DynamoDB) keeps idle cost ≈ $0 and scales automatically.
2. **Container option**: If long-running streaming or heavy MQTT ↔️ Kafka bridging is needed, 👉 run the existing Go binaries in **ECS Fargate**. You pay only per-second per-task.
3. **Front-end hosting**: Single-Page-App (React/Vue) is built separately and deployed to **S3 + CloudFront** or **AWS Amplify Hosting**.
4. **Map rendering** uses Amazon Location Service (free tier includes 250k map tiles/month).
5. **Kinesis Firehose → S3** gives cheap long-term raw data storage without maintaining Kafka.

---

## 2. Preparing the Codebase

1. **Dockerise** (already present: `Dockerfile`).
   ```bash
   docker build -t tesla-fleet-telemetry:latest .
   ```
2. **Multi-entry binaries**:
   • `cmd/main.go` → REST / WebSocket API handler.
   • `tools/main.go` → CLI utilities.
   • Streaming consumers in `server/streaming`.
3. Add **Make targets**:
   ```makefile
   docker-push:
       aws ecr get-login-password --region $(AWS_REGION) | \
         docker login --username AWS --password-stdin $(ECR_URI)
       docker tag tesla-fleet-telemetry:latest $(ECR_URI):latest
       docker push $(ECR_URI):latest
   ```

---

## 3. AWS Resource Creation (Minimal Viable Deployment)

| Layer | Service | Terraform module/CloudFormation resource |
|-------|---------|------------------------------------------|
| Auth  | Cognito User Pool + Federated Identity (OIDC) | `aws_cognito_user_pool`, `aws_cognito_identity_provider` |
| API   | API Gateway (HTTP) | `aws_apigatewayv2_api`, integration = Lambda proxy |
| Logic | Lambda (Go 1.x or provided.al2) | `aws_lambda_function` |
| Data  | DynamoDB (table: `vehicles`, `users`) | `aws_dynamodb_table` |
| Static UI | S3 + CloudFront | `aws_s3_bucket`, `aws_cloudfront_distribution` |
| Maps | Amazon Location Service | no IaC required for public access |

> 🚀 **One-click**: Use AWS SAM or CDK to define all the above and deploy with one command.

### 3.1 Example CDK Stack (TypeScript excerpt)
```ts
const api = new HttpApi(this, 'Api');
const fn = new GoFunction(this, 'Handler', {
  entry: 'cmd',
  bundling: { goBuildFlags: ['-ldflags', '-s -w'] }
});
api.addRoutes({ path: '/{proxy+}', methods: [HttpMethod.ANY], integration: new HttpLambdaIntegration('int', fn) });
```

---

## 4. Continuous Delivery Pipeline

1. **Source**: GitHub → CodePipeline (trigger on `main`).
2. **Build**: CodeBuild — run `go test ./...`, build Docker image, push to ECR.
3. **Deploy**: CDK Synth → CloudFormation change-set.

Cost: CodePipeline + CodeBuild in free tier cover 100 build minutes/month.

---

## 5. Front-End Deployment (Optional)

1. Build your SPA (React/Vite) using Tesla JS SDK for OAuth handshake.
2. `npm run build` outputs to `dist/`.
3. `aws s3 sync dist/ s3://$WEB_BUCKET --delete`.
4. Invalidate CloudFront.
5. Or push repository to **AWS Amplify** for automatic build & deploy.

---

## 6. Tesla OAuth Integration

Tesla provides an **OIDC**-compatible token exchange. Steps:
1. Register your AWS Cognito callback URL `https://<domain>/oauth2/idpresponse`.
2. In Cognito → *Identity Providers* → OpenID Connect → add Tesla endpoints.
3. Configure scopes: `openid email offline_access vehicle_read vehicle_cmd`.
4. Post sign-in, Cognito issues JWTs held by the SPA and attached to every API request.

Lambda handler example:
```go
user := ctx.Value(oidc.CognitoUserIDKey).(string)
```

---

## 7. Extending to Micro-services

| Future Feature | Suggested Service |
|----------------|------------------|
| Billing / subscription | AWS Marketplace or Stripe-via-Lambda |
| WebSockets for live updates | API Gateway (WebSocket) + DynamoDB Streams |
| Advanced analytics | Athena / QuickSight on S3 Parquet |
| Machine learning | SageMaker on data in S3 |

Because the core is serverless, each additional feature can be a **micro-service** deployed independently (its own Lambda, Fargate task, or container-based workload).

---

## 8. Cost Estimate (us-east-1, monthly, ~10 active users)

| Item | Free Tier | Expected | Comments |
|------|-----------|----------|----------|
| API Gateway | 1 M requests | <0.05 M | $0 |
| Lambda | 1 M req / 400k GB-s | <0.1 M / 10k | $0 |
| DynamoDB | 25 GB / 200 M RCU/WCU | <1 GB | $0 |
| S3 static site | 50 GB | 1 GB | $0 |
| Kinesis (optional) | — | $40 | Remove for MVP |
| Location maps | 250k tiles | 20k | $0 |
| TOTAL | | **≈ $0-40** |

Removing Kinesis & Kafka keeps the MVP inside the free tier.

---

## 9. Should the project host front-end too?

### Option A – Backend-only micro-service (current code)
Pros:
• Small blast radius, stateless Go service.
• Front-end can iterate separately (any hosting).
Cons:
• Two deployments to manage (API + web).

### Option B – Mono-repo full-stack
Modify current Go server to:
• Serve `index.html` & static assets under `/`.
• Embed assets using `go:embed` (Go 1.16+). Example:
```go
//go:embed web/dist
var content embed.FS
```
• Keep REST & WebSocket routes under `/api/*`.
Pros:
• Single artifact, single deployment (simpler).
Cons:
• Less flexibility for CDN, increases container size.

> **Recommendation**: Keep **backend-only** pattern. Host SPA in S3/CloudFront – cheapest, fastest, decoupled.

---

## 10. Step-by-Step Cheatsheet (MVP – 30 min)

1. `aws configure`
2. `aws ecr create-repository --repository-name tft`
3. `make docker-push`
4. Clone `iac/` folder (CDK/SAM) – adjust env vars.
5. `cdk deploy` (or `sam deploy –guided`).
6. `npm run build` (front-end), `aws s3 sync dist/ s3://$WEBBUCKET --delete`.
7. Browse CloudFront URL → sign-in with Tesla.
8. Vehicle list appears – data ingests via Lambda.

---

## 11. Cleanup

```bash
cdk destroy        # or sam delete
aws s3 rb s3://$WEBBUCKET --force
aws ecr delete-repository --repository-name tft --force
```

---

## 12. References

• AWS Well-Architected Serverless Lens
• AWS Location Service pricing
• Tesla unofficial OAuth documentation
• AWS CDK GoFunction construct