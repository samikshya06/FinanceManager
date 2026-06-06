const { Transaction, Statement, sequelize } = require('../models');

/**
 * TransactionController
 * Handles database operations for Transaction model
 */
class TransactionController {
    /**
     * Create a new transaction
     * @param {string} stmt_id - Statement ID (foreign key)
     * @param {string} transaction - Transaction description
     * @param {number} tr_amt - Transaction amount
     * @param {string} tr_date - Transaction date (YYYY-MM-DD)
     * @param {string} trans_type - Transaction type (debit, credit, etc.)
     * @returns {Promise<object>} Created transaction record
     */
    static async create(stmt_id, transaction, tr_amt, tr_date, trans_type) {
        const transactionWrapper = await sequelize.transaction();
        try {
            if (!stmt_id || !transaction || !tr_amt || !tr_date || !trans_type) {
                throw new Error('All fields (stmt_id, transaction, tr_amt, tr_date, trans_type) are required');
            }

            // Verify statement exists
            const statement = await Statement.findByPk(stmt_id, { transaction: transactionWrapper });
            if (!statement) {
                throw new Error(`Statement not found: ${stmt_id}`);
            }

            const newTransaction = await Transaction.create(
                {
                    stmt_id,
                    transaction,
                    tr_amt: parseFloat(tr_amt),
                    tr_date,
                    trans_type,
                },
                { transaction: transactionWrapper }
            );

            await transactionWrapper.commit();
            console.log(`Transaction created successfully: ${newTransaction.tr_id}`);
            return {
                success: true,
                data: newTransaction,
                message: 'Transaction created successfully',
            };
        } catch (error) {
            await transactionWrapper.rollback();
            console.error('Error creating transaction:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create transaction',
            };
        }
    }

    /**
     * Update an existing transaction
     * @param {number} tr_id - Transaction ID to update
     * @param {object} updateData - Data to update (transaction, tr_amt, tr_date, trans_type)
     * @returns {Promise<object>} Updated transaction record
     */
    static async update(tr_id, updateData) {
        const transaction = await sequelize.transaction();
        try {
            if (!tr_id) {
                throw new Error('tr_id is required');
            }

            const transactionRecord = await Transaction.findByPk(tr_id, { transaction });
            if (!transactionRecord) {
                throw new Error(`Transaction not found: ${tr_id}`);
            }

            // Sanitize numeric fields
            if (updateData.tr_amt) {
                updateData.tr_amt = parseFloat(updateData.tr_amt);
            }

            const updated = await transactionRecord.update(updateData, { transaction });
            await transaction.commit();

            console.log(`Transaction updated successfully: ${tr_id}`);
            return {
                success: true,
                data: updated,
                message: 'Transaction updated successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating transaction:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update transaction',
            };
        }
    }

    /**
     * Get transaction by ID
     * @param {number} tr_id - Transaction ID
     * @returns {Promise<object>} Transaction record
     */
    static async getById(tr_id) {
        try {
            const transactionRecord = await Transaction.findByPk(tr_id);
            if (!transactionRecord) {
                return {
                    success: false,
                    error: `Transaction not found: ${tr_id}`,
                };
            }
            return {
                success: true,
                data: transactionRecord,
            };
        } catch (error) {
            console.error('Error fetching transaction:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get all transactions for a statement
     * @param {string} stmt_id - Statement ID
     * @returns {Promise<object>} Array of transactions
     */
    static async getByStatementId(stmt_id) {
        try {
            const transactions = await Transaction.findAll({
                where: { stmt_id },
                order: [['tr_date', 'DESC']],
            });
            return {
                success: true,
                data: transactions,
                count: transactions.length,
            };
        } catch (error) {
            console.error('Error fetching transactions:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get transactions by date range
     * @param {string} stmt_id - Statement ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<object>} Array of transactions within date range
     */
    static async getByDateRange(stmt_id, startDate, endDate) {
        try {
            const { Op } = require('sequelize');
            const transactions = await Transaction.findAll({
                where: {
                    stmt_id,
                    tr_date: {
                        [Op.between]: [startDate, endDate],
                    },
                },
                order: [['tr_date', 'DESC']],
            });
            return {
                success: true,
                data: transactions,
                count: transactions.length,
            };
        } catch (error) {
            console.error('Error fetching transactions by date range:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete a transaction
     * @param {number} tr_id - Transaction ID to delete
     * @returns {Promise<object>} Deletion result
     */
    static async delete(tr_id) {
        const transaction = await sequelize.transaction();
        try {
            if (!tr_id) {
                throw new Error('tr_id is required');
            }

            const deleted = await Transaction.destroy(
                { where: { tr_id } },
                { transaction }
            );

            await transaction.commit();

            if (deleted === 0) {
                return {
                    success: false,
                    error: `No transaction found to delete: ${tr_id}`,
                };
            }

            console.log(`Transaction deleted successfully: ${tr_id}`);
            return {
                success: true,
                message: 'Transaction deleted successfully',
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting transaction:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete all transactions for a statement
     * @param {string} stmt_id - Statement ID
     * @returns {Promise<object>} Deletion result
     */
    static async deleteByStatementId(stmt_id) {
        const transaction = await sequelize.transaction();
        try {
            if (!stmt_id) {
                throw new Error('stmt_id is required');
            }

            const deleted = await Transaction.destroy(
                { where: { stmt_id } },
                { transaction }
            );

            await transaction.commit();

            console.log(`Transactions deleted for statement: ${stmt_id} (count: ${deleted})`);
            return {
                success: true,
                message: `${deleted} transactions deleted successfully`,
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting transactions:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = TransactionController;
