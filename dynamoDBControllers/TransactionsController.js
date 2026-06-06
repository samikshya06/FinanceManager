const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TRANSACTIONS_TABLE = 'transactions';

class TransactionsController {
  static async createTransaction(transaction) {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Item: transaction,
    };
    return dynamoDB.put(params).promise();
  }

  static async getTransactionById(transactionId) {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Key: { transaction_id: transactionId },
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  static async updateTransaction(transactionId, updates) {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Key: { transaction_id: transactionId },
      UpdateExpression: 'set #amount = :amount, description = :description',
      ExpressionAttributeNames: {
        '#amount': 'amount',
        '#description': 'description',
      },
      ExpressionAttributeValues: {
        ':amount': updates.amount,
        ':description': updates.description,
      },
      ReturnValues: 'ALL_NEW',
    };
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  static async deleteTransaction(transactionId) {
    const params = {
      TableName: TRANSACTIONS_TABLE,
      Key: { transaction_id: transactionId },
    };
    return dynamoDB.delete(params).promise();
  }
}

module.exports = TransactionsController;