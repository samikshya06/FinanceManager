require('dotenv').config();
const sequelize = require('./models/db');

// Test database connection
async function testConnection() {
    try {
        // Test the connection
        await sequelize.authenticate();
        console.log('✅ Database connection successful!');

        // Close the connection
        await sequelize.close();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testConnection();