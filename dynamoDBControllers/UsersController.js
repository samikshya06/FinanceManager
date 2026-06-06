const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = 'users';

class UsersController {
  static async createUser(user) {
    const params = {
      TableName: USERS_TABLE,
      Item: user,
    };
    return dynamoDB.put(params).promise();
  }

  static async getUserById(userId) {
    const params = {
      TableName: USERS_TABLE,
      Key: { user_id: userId },
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  static async updateUser(userId, updates) {
    const params = {
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'set #name = :name, email = :email',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': updates.name,
        ':email': updates.email,
      },
      ReturnValues: 'ALL_NEW',
    };
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  static async deleteUser(userId) {
    const params = {
      TableName: USERS_TABLE,
      Key: { user_id: userId },
    };
    return dynamoDB.delete(params).promise();
  }
}

module.exports = UsersController;