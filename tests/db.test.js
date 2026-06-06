const sequelize = require('../models/db');

describe('Database Connection', () => {
    afterAll(async () => {
        // Close the connection after all tests
        await sequelize.close();
    });

    test('should connect to PostgreSQL database', async () => {
        await sequelize.authenticate();
        expect(true).toBe(true); // If no error, connection is successful
    });

    test('should handle database queries', async () => {
        const [results] = await sequelize.query('SELECT NOW() as current_time');
        expect(results[0]).toHaveProperty('current_time');
        expect(results[0].current_time).toBeInstanceOf(Date);
    });
});