import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as destinations from 'aws-cdk-lib/aws-kinesisfirehose-destinations';
import { Construct } from 'constructs';

export interface TeslaFleetTelemetryStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  apiUrl: string;
  frontendUrl: string;
}

export class TeslaFleetTelemetryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TeslaFleetTelemetryStackProps) {
    super(scope, id, props);

    // Create S3 bucket for telemetry data storage
    const telemetryDataBucket = new s3.Bucket(this, 'TelemetryDataBucket', {
      bucketName: `tesla-fleet-telemetry-data-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'ArchiveOldData',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // Create Kinesis Data Stream for real-time telemetry
    const telemetryStream = new kinesis.Stream(this, 'TelemetryStream', {
      streamName: 'tesla-fleet-telemetry-stream',
      shardCount: 1, // Start with 1 shard, can scale up
      retentionPeriod: cdk.Duration.hours(24),
      encryption: kinesis.StreamEncryption.KMS,
    });

    // Create Kinesis Firehose for data delivery to S3
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    telemetryDataBucket.grantReadWrite(firehoseRole);

    const firehoseDeliveryStream = new firehose.CfnDeliveryStream(this, 'TelemetryFirehose', {
      deliveryStreamName: 'tesla-fleet-telemetry-firehose',
      deliveryStreamType: 'DirectPut',
      s3DestinationConfiguration: {
        bucketArn: telemetryDataBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        prefix: 'telemetry/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 50,
        },
        compressionFormat: 'GZIP',
      },
    });

    // Create CloudWatch Log Group for application logs
    const applicationLogGroup = new logs.LogGroup(this, 'ApplicationLogGroup', {
      logGroupName: '/aws/tesla-fleet-telemetry/application',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create IAM role for the telemetry service
    const telemetryServiceRole = new iam.Role(this, 'TelemetryServiceRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant permissions to telemetry service
    telemetryServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kinesis:PutRecord',
        'kinesis:PutRecords',
        'kinesis:DescribeStream',
      ],
      resources: [telemetryStream.streamArn],
    }));

    telemetryServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [applicationLogGroup.logGroupArn],
    }));

    // Create IAM role for CI/CD
    const cicdRole = new iam.Role(this, 'CICDRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });

    // Grant CI/CD permissions
    cicdRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
      ],
      resources: ['*'],
    }));

    cicdRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: [
        `arn:aws:s3:::tesla-fleet-frontend-${this.account}`,
        `arn:aws:s3:::tesla-fleet-frontend-${this.account}/*`,
      ],
    }));

    cicdRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: ['*'],
    }));

    // Outputs
    new cdk.CfnOutput(this, 'TelemetryDataBucketName', {
      value: telemetryDataBucket.bucketName,
      description: 'S3 Bucket for Telemetry Data',
      exportName: `${this.stackName}-TelemetryDataBucketName`,
    });

    new cdk.CfnOutput(this, 'TelemetryStreamName', {
      value: telemetryStream.streamName,
      description: 'Kinesis Stream Name',
      exportName: `${this.stackName}-TelemetryStreamName`,
    });

    new cdk.CfnOutput(this, 'FirehoseDeliveryStreamName', {
      value: firehoseDeliveryStream.deliveryStreamName!,
      description: 'Kinesis Firehose Delivery Stream Name',
      exportName: `${this.stackName}-FirehoseDeliveryStreamName`,
    });

    new cdk.CfnOutput(this, 'ApplicationLogGroupName', {
      value: applicationLogGroup.logGroupName,
      description: 'CloudWatch Log Group for Application',
      exportName: `${this.stackName}-ApplicationLogGroupName`,
    });

    new cdk.CfnOutput(this, 'TelemetryServiceRoleArn', {
      value: telemetryServiceRole.roleArn,
      description: 'IAM Role for Telemetry Service',
      exportName: `${this.stackName}-TelemetryServiceRoleArn`,
    });

    new cdk.CfnOutput(this, 'CICDRoleArn', {
      value: cicdRole.roleArn,
      description: 'IAM Role for CI/CD',
      exportName: `${this.stackName}-CICDRoleArn`,
    });
  }
}