const { DataTypes } = require('sequelize');
const sequelize = require('./db');

/**
 * Transaction Model
 * Table: transactions
 */
const Transaction = sequelize.define('Transaction', {
    tr_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    stmt_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        references: {
            model: 'statements',
            key: 'stmt_id',
        },
        onDelete: 'CASCADE',
    },
    transaction: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    tr_amt: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    tr_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    trans_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
}, {
    tableName: 'transactions',
    timestamps: false,
    indexes: [
        { fields: ['stmt_id'] },
        { fields: ['tr_date'] },
    ],
});

module.exports = Transaction;
