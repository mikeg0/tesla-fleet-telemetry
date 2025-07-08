import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create ECR repository for the telemetry service
    const telemetryRepo = new ecr.Repository(this, 'TelemetryRepository', {
      repositoryName: 'tesla-fleet-telemetry',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    });

    // Create VPC for ECS
    const vpc = new ec2.Vpc(this, 'TelemetryVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'TelemetryCluster', {
      vpc,
      clusterName: 'tesla-fleet-telemetry',
    });

    // Create Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TelemetryTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    // Add container to task definition
    const container = taskDefinition.addContainer('TelemetryContainer', {
      image: ecs.ContainerImage.fromEcrRepository(telemetryRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'telemetry',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        AWS_REGION: this.region,
      },
    });

    container.addPortMappings({
      containerPort: 443,
      protocol: ecs.Protocol.TCP,
    });

    // Create ECS Service
    const service = new ecs.FargateService(this, 'TelemetryService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      serviceName: 'tesla-fleet-telemetry',
      assignPublicIp: false,
    });

    // Create Application Load Balancer
    const alb = new cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer(this, 'TelemetryALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: 'tesla-fleet-telemetry-alb',
    });

    // Create target group
    const targetGroup = new cdk.aws_elasticloadbalancingv2.ApplicationTargetGroup(this, 'TelemetryTargetGroup', {
      vpc,
      port: 443,
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
      targetType: cdk.aws_elasticloadbalancingv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        port: '443',
        protocol: cdk.aws_elasticloadbalancingv2.Protocol.HTTPS,
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(30),
        interval: cdk.Duration.seconds(60),
      },
    });

    // Add service to target group
    service.attachToApplicationTargetGroup(targetGroup);

    // Create listener
    const listener = alb.addListener('TelemetryListener', {
      port: 443,
      protocol: cdk.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
      certificates: [], // Add your SSL certificate here
      defaultAction: cdk.aws_elasticloadbalancingv2.ListenerAction.forward([targetGroup]),
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'TeslaFleetApi', {
      restApiName: 'Tesla Fleet Telemetry API',
      description: 'API for Tesla Fleet Telemetry service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'TeslaFleetAuthorizer', {
      cognitoUserPools: [props.userPool],
    });

    // Create Lambda function for API handlers
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'main',
      code: lambda.Code.fromAsset('../cmd'), // Path to your Go binary
      environment: {
        USERS_TABLE: 'tesla-fleet-users',
        VEHICLES_TABLE: 'tesla-fleet-vehicles',
        TELEMETRY_TABLE: 'tesla-fleet-telemetry',
        TELEMETRY_SERVICE_URL: `https://${alb.loadBalancerDnsName}`,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Grant DynamoDB permissions to Lambda
    apiHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [
        'arn:aws:dynamodb:*:*:table/tesla-fleet-users',
        'arn:aws:dynamodb:*:*:table/tesla-fleet-vehicles',
        'arn:aws:dynamodb:*:*:table/tesla-fleet-telemetry',
      ],
    }));

    // Create API Gateway integration
    const integration = new apigateway.LambdaIntegration(apiHandler);

    // Add API routes
    const apiResource = api.root.addResource('api');

    // Vehicles endpoint
    const vehiclesResource = apiResource.addResource('vehicles');
    vehiclesResource.addMethod('GET', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Telemetry endpoint
    const telemetryResource = apiResource.addResource('telemetry');
    const telemetryVinResource = telemetryResource.addResource('{vin}');
    telemetryVinResource.addMethod('GET', integration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Health check endpoint
    const healthResource = apiResource.addResource('health');
    healthResource.addMethod('GET', integration);

    // Store API URL
    this.apiUrl = api.url;

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'TelemetryServiceUrl', {
      value: `https://${alb.loadBalancerDnsName}`,
      description: 'Telemetry Service URL',
      exportName: `${this.stackName}-TelemetryServiceUrl`,
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: telemetryRepo.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${this.stackName}-EcrRepositoryUri`,
    });
  }
}