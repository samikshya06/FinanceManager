const { DataTypes } = require('sequelize');
const sequelize = require('./db');

/**
 * Statement Model
 * Table: users
 */
const User = sequelize.define('User', { 
    user_id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
    },
    name: {     
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {    
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    // hashed password for security
    password: {
        type: DataTypes.STRING(255),
        allowNull: true,  // Allow null for OAuth users
    },
    googleId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,   
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'users', 
    timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { fields: ['email'] },
    ],
});

module.exports = User;