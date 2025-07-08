import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  domainName: string;
  teslaClientId: string;
  teslaClientSecret: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'TeslaFleetUserPool', {
      userPoolName: 'tesla-fleet-users',
      selfSignUpEnabled: false, // Only allow Tesla OAuth
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        teslaUserId: new cognito.StringAttribute({ mutable: true }),
        vehicleIds: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add Tesla as an OIDC Identity Provider
    const teslaProvider = new cognito.UserPoolIdentityProviderOidc(this, 'TeslaProvider', {
      userPool: this.userPool,
      name: 'Tesla',
      clientId: props.teslaClientId,
      clientSecret: props.teslaClientSecret,
      issuerUrl: 'https://auth.tesla.com',
      attributeRequestMethod: cognito.AttributeRequestMethod.GET,
      attributeMapping: {
        email: cognito.ProviderAttribute.other('email'),
        emailVerified: cognito.ProviderAttribute.other('email_verified'),
        name: cognito.ProviderAttribute.other('name'),
        givenName: cognito.ProviderAttribute.other('given_name'),
        familyName: cognito.ProviderAttribute.other('family_name'),
        custom: {
          teslaUserId: cognito.ProviderAttribute.other('sub'),
        },
      },
      scopes: ['openid', 'email', 'profile', 'offline_access'],
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'TeslaFleetClient', {
      userPool: this.userPool,
      userPoolClientName: 'tesla-fleet-web-client',
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${props.domainName}/auth/callback`,
          'http://localhost:3000/auth/callback', // For local development
        ],
        logoutUrls: [
          `https://${props.domainName}/auth/logout`,
          'http://localhost:3000/auth/logout', // For local development
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.custom(teslaProvider.providerName),
      ],
    });

    // Create User Pool Domain
    const userPoolDomain = new cognito.UserPoolDomain(this, 'TeslaFleetDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: 'tesla-fleet-auth',
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: userPoolDomain.domainName,
      description: 'Cognito User Pool Domain',
      exportName: `${this.stackName}-UserPoolDomain`,
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Domain URL',
      exportName: `${this.stackName}-CognitoDomainUrl`,
    });
  }
}