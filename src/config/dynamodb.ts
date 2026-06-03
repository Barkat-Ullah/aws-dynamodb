import * as dynamoose from "dynamoose";

const ddb = new dynamoose.aws.ddb.DynamoDB({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

dynamoose.aws.ddb.set(ddb);

export default dynamoose;