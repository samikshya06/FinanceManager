const { Sequelize } = require('sequelize');

// Sequelize instance configuration
const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging: console.log, // Set to false to disable logging
});

// Test connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PostgreSQL database with Sequelize');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(-1);
    }
}

testConnection();

module.exports = sequelize;
