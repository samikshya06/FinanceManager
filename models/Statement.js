const { DataTypes } = require('sequelize');
const sequelize = require('./db');

/**
 * Statement Model
 * Table: statements
 */
const Statement = sequelize.define('Statement', {
    stmt_id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pending',
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'statements',
    timestamps: false, // Since we're using created_at manually
});

module.exports = Statement;
