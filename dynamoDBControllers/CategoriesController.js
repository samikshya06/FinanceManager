const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const CATEGORIES_TABLE = 'categories';

class CategoriesController {
  static async createCategory(category) {
    const params = {
      TableName: CATEGORIES_TABLE,
      Item: category,
    };
    return dynamoDB.put(params).promise();
  }

  static async getCategoryById(categoryId) {
    const params = {
      TableName: CATEGORIES_TABLE,
      Key: { category_id: categoryId },
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  }

  static async updateCategory(categoryId, updates) {
    const params = {
      TableName: CATEGORIES_TABLE,
      Key: { category_id: categoryId },
      UpdateExpression: 'set #name = :name, budget = :budget',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#budget': 'budget',
      },
      ExpressionAttributeValues: {
        ':name': updates.name,
        ':budget': updates.budget,
      },
      ReturnValues: 'ALL_NEW',
    };
    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }

  static async deleteCategory(categoryId) {
    const params = {
      TableName: CATEGORIES_TABLE,
      Key: { category_id: categoryId },
    };
    return dynamoDB.delete(params).promise();
  }
}

module.exports = CategoriesController;