import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {}

export class DatabaseStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly vehiclesTable: dynamodb.Table;
  public readonly telemetryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Users table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'tesla-fleet-users',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Add GSI for email lookups
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Vehicles table
    this.vehiclesTable = new dynamodb.Table(this, 'VehiclesTable', {
      tableName: 'tesla-fleet-vehicles',
      partitionKey: {
        name: 'vin',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Add GSI for user's vehicles
    this.vehiclesTable.addGlobalSecondaryIndex({
      indexName: 'UserVehiclesIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastSeen',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Telemetry data table (for recent data)
    this.telemetryTable = new dynamodb.Table(this, 'TelemetryTable', {
      tableName: 'tesla-fleet-telemetry',
      partitionKey: {
        name: 'vin',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This can be recreated
      timeToLiveAttribute: 'ttl', // Auto-delete old data
    });

    // Add GSI for time-based queries
    this.telemetryTable.addGlobalSecondaryIndex({
      indexName: 'TimeIndex',
      partitionKey: {
        name: 'dateHour',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB Users Table Name',
      exportName: `${this.stackName}-UsersTableName`,
    });

    new cdk.CfnOutput(this, 'VehiclesTableName', {
      value: this.vehiclesTable.tableName,
      description: 'DynamoDB Vehicles Table Name',
      exportName: `${this.stackName}-VehiclesTableName`,
    });

    new cdk.CfnOutput(this, 'TelemetryTableName', {
      value: this.telemetryTable.tableName,
      description: 'DynamoDB Telemetry Table Name',
      exportName: `${this.stackName}-TelemetryTableName`,
    });
  }
}