const { Statement, sequelize } = require('../models');

/**
 * StatementController
 * Handles database operations for Statement model
 */
class StatementController {
    /**
     * Create a new statement
     * @param {string} stmt_id - Unique statement identifier
     * @param {string} user_id - User ID
     * @param {string} status - Statement status (pending, processed, failed)
     * @returns {Promise<object>} Created statement record
     */
    static async create(stmt_id, user_id, status = 'pending') {
        const transaction = await sequelize.transaction();
        try {
            if (!stmt_id || !user_id) {
                throw new Error('stmt_id and user_id are required');
            }

            const statement = await Statement.create(
                {
                    stmt_id,
                    user_id,
                    status,
                    created_at: new Date(),
                },
                { transaction }
            );

            await transaction.commit();
            console.log(`Statement created successfully: ${stmt_id}`);
            return {
                success: true,
                data: statement,
                message: 'Statement created successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error creating statement:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create statement',
            };
        }
    }

    /**
     * Update an existing statement
     * @param {string} stmt_id - Statement ID to update
     * @param {object} updateData - Data to update (status, etc.)
     * @returns {Promise<object>} Updated statement record
     */
    static async update(stmt_id, updateData) {
        const transaction = await sequelize.transaction();
        try {
            if (!stmt_id) {
                throw new Error('stmt_id is required');
            }

            const statement = await Statement.findByPk(stmt_id, { transaction });
            if (!statement) {
                throw new Error(`Statement not found: ${stmt_id}`);
            }

            const updated = await statement.update(updateData, { transaction });
            await transaction.commit();

            console.log(`Statement updated successfully: ${stmt_id}`);
            return {
                success: true,
                data: updated,
                message: 'Statement updated successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating statement:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update statement',
            };
        }
    }

    /**
     * Get statement by ID
     * @param {string} stmt_id - Statement ID
     * @returns {Promise<object>} Statement record
     */
    static async getById(stmt_id) {
        try {
            const statement = await Statement.findByPk(stmt_id);
            if (!statement) {
                return {
                    success: false,
                    error: `Statement not found: ${stmt_id}`,
                };
            }
            return {
                success: true,
                data: statement,
            };
        } catch (error) {
            console.error('Error fetching statement:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get all statements for a user
     * @param {string} user_id - User ID
     * @returns {Promise<object>} Array of statements
     */
    static async getByUserId(user_id) {
        try {
            const statements = await Statement.findAll({
                where: { user_id },
                order: [['created_at', 'DESC']],
            });
            return {
                success: true,
                data: statements,
                count: statements.length,
            };
        } catch (error) {
            console.error('Error fetching statements:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete a statement
     * @param {string} stmt_id - Statement ID to delete
     * @returns {Promise<object>} Deletion result
     */
    static async delete(stmt_id) {
        const transaction = await sequelize.transaction();
        try {
            if (!stmt_id) {
                throw new Error('stmt_id is required');
            }

            const deleted = await Statement.destroy(
                { where: { stmt_id } },
                { transaction }
            );

            await transaction.commit();

            if (deleted === 0) {
                return {
                    success: false,
                    error: `No statement found to delete: ${stmt_id}`,
                };
            }

            console.log(`Statement deleted successfully: ${stmt_id}`);
            return {
                success: true,
                message: 'Statement deleted successfully',
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting statement:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = StatementController;
