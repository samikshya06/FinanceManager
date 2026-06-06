const sequelize = require('./db');
const Statement = require('./Statement');
const Transaction = require('./Transaction');
const Categories = require('./Categories');
const User = require('./User');

// Define associations
Statement.hasMany(Transaction, { foreignKey: 'stmt_id', sourceKey: 'stmt_id' });
Transaction.belongsTo(Statement, { foreignKey: 'stmt_id', targetKey: 'stmt_id' });

Statement.hasOne(Categories, { foreignKey: 'stmt_id', sourceKey: 'stmt_id' });
Categories.belongsTo(Statement, { foreignKey: 'stmt_id', targetKey: 'stmt_id' });

User.hasMany(Statement, { foreignKey: 'user_id', sourceKey: 'user_id' });
Statement.belongsTo(User, { foreignKey: 'user_id', targetKey: 'user_id' });

/**
 * Initialize database tables
 */
async function initializeDatabase() {
    try {
        await sequelize.sync({ force: false }); // Set force: true to drop and recreate tables
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Database synchronization failed:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    Statement,
    Transaction,
    Categories,
    User,
    initializeDatabase
};
