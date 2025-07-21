#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TeslaFleetTelemetryStack } from '../lib/tesla-fleet-telemetry-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack configuration
const projectName = 'TeslaFleetTelemetry';
const domainName = process.env.DOMAIN_NAME || 'tesla-fleet.example.com';
const domainPrefix = process.env.COGNITO_DOMAIN_PREFIX || 'track-my-tessie';
const teslaClientId = process.env.TESLA_CLIENT_ID || '';
const teslaClientSecret = process.env.TESLA_CLIENT_SECRET || '';

if (!teslaClientId || !teslaClientSecret) {
  console.error('TESLA_CLIENT_ID and TESLA_CLIENT_SECRET environment variables are required');
  process.exit(1);
}

// Create stacks
const authStack = new AuthStack(app, `${projectName}Auth`, {
  env,
  domainName,
  domainPrefix,
  teslaClientId,
  teslaClientSecret,
  description: 'Tesla Fleet Telemetry - Authentication Stack',
});

const databaseStack = new DatabaseStack(app, `${projectName}Database`, {
  env,
  description: 'Tesla Fleet Telemetry - Database Stack',
});

const apiStack = new ApiStack(app, `${projectName}Api`, {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  description: 'Tesla Fleet Telemetry - API Stack',
});

const frontendStack = new FrontendStack(app, `${projectName}Frontend`, {
  env,
  domainName,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  apiUrl: apiStack.apiUrl,
  description: 'Tesla Fleet Telemetry - Frontend Stack',
});

const mainStack = new TeslaFleetTelemetryStack(app, `${projectName}Main`, {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  apiUrl: apiStack.apiUrl,
  frontendUrl: frontendStack.frontendUrl,
  description: 'Tesla Fleet Telemetry - Main Infrastructure Stack',
});

// Add dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(databaseStack);
frontendStack.addDependency(authStack);
mainStack.addDependency(apiStack);
mainStack.addDependency(frontendStack);

// Add tags to all stacks
const tags = {
  Project: projectName,
  Environment: 'production',
  ManagedBy: 'CDK',
};

[authStack, databaseStack, apiStack, frontendStack, mainStack].forEach(stack => {
  Object.entries(tags).forEach(([key, value]) => {
    cdk.Tags.of(stack).add(key, value);
  });
});

app.synth();