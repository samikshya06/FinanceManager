const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const STATEMENTS_TABLE = 'statements';

class StatementsController {
  static async createStatement(statement) {
    const params = {
      TableName: STATEMENTS_TABLE,
      Item: statement,
    };
    return dynamoDB.put(params).promise();
  }

  static async getStatementById(stmtId) {
    const params = {
      TableName: STATEMENTS_TABLE,
      Key: { stmt_id: stmtId },
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  static async updateStatement(stmtId, updates) {
    const params = {
      TableName: STATEMENTS_TABLE,
      Key: { stmt_id: stmtId },
      UpdateExpression: 'set #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': updates.status,
      },
      ReturnValues: 'ALL_NEW',
    };
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  static async deleteStatement(stmtId) {
    const params = {
      TableName: STATEMENTS_TABLE,
      Key: { stmt_id: stmtId },
    };
    return dynamoDB.delete(params).promise();
  }
}

module.exports = StatementsController;