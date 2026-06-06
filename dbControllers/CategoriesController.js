const { Categories, Statement, sequelize } = require('../models');

/**
 * CategoriesController
 * Handles database operations for Categories model
 */
class CategoriesController {
    /**
     * Create a new category entry
     * @param {string} user_id - User ID
     * @param {string} stmt_id - Statement ID (foreign key)
     * @param {number} savings - Savings amount
     * @param {number} shopping_merc - Shopping (Merc) amount
     * @param {number} food_orders - Food Orders amount
     * @param {number} bills - Bills amount
     * @param {number} transfers - Transfers amount
     * @param {number} salary - Salary amount
     * @param {number} others - Others/Miscellaneous amount
     * @returns {Promise<object>} Created category record
     */
    static async create(
        user_id,
        stmt_id,
        savings = 0,
        shopping_merc = 0,
        food_orders = 0,
        bills = 0,
        transfers = 0,
        salary = 0,
        others = 0
    ) {
        const transaction = await sequelize.transaction();
        try {
            if (!user_id || !stmt_id) {
                throw new Error('user_id and stmt_id are required');
            }

            // Verify statement exists
            const statement = await Statement.findByPk(stmt_id, { transaction });
            if (!statement) {
                throw new Error(`Statement not found: ${stmt_id}`);
            }

            // Check if category already exists for this statement
            const existingCategory = await Categories.findOne(
                { where: { stmt_id } },
                { transaction }
            );
            if (existingCategory) {
                await transaction.rollback();
                return {
                    success: false,
                    error: `Category already exists for statement: ${stmt_id}`,
                    message: 'Category entry already exists',
                };
            }

            const category = await Categories.create(
                {
                    user_id,
                    stmt_id,
                    savings: parseFloat(savings) || 0,
                    shopping_merc: parseFloat(shopping_merc) || 0,
                    food_orders: parseFloat(food_orders) || 0,
                    bills: parseFloat(bills) || 0,
                    transfers: parseFloat(transfers) || 0,
                    salary: parseFloat(salary) || 0,
                    others: parseFloat(others) || 0,
                    created_at: new Date(),
                },
                { transaction }
            );

            await transaction.commit();
            console.log(`Category created successfully for statement: ${stmt_id}`);
            return {
                success: true,
                data: category,
                message: 'Category created successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error creating category:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create category',
            };
        }
    }

    /**
     * Update an existing category entry
     * @param {number} id - Category ID to update
     * @param {object} updateData - Data to update (any of the amount fields)
     * @returns {Promise<object>} Updated category record
     */
    static async update(id, updateData) {
        const transaction = await sequelize.transaction();
        try {
            if (!id) {
                throw new Error('id is required');
            }

            const category = await Categories.findByPk(id, { transaction });
            if (!category) {
                throw new Error(`Category not found: ${id}`);
            }

            // Sanitize numeric fields
            const numericFields = ['savings', 'shopping_merc', 'food_orders', 'bills', 'transfers', 'salary', 'others'];
            numericFields.forEach((field) => {
                if (updateData[field] !== undefined) {
                    updateData[field] = parseFloat(updateData[field]) || 0;
                }
            });

            const updated = await category.update(updateData, { transaction });
            await transaction.commit();

            console.log(`Category updated successfully: ${id}`);
            return {
                success: true,
                data: updated,
                message: 'Category updated successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating category:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update category',
            };
        }
    }

    /**
     * Get category by ID
     * @param {number} id - Category ID
     * @returns {Promise<object>} Category record
     */
    static async getById(id) {
        try {
            const category = await Categories.findByPk(id);
            if (!category) {
                return {
                    success: false,
                    error: `Category not found: ${id}`,
                };
            }
            return {
                success: true,
                data: category,
            };
        } catch (error) {
            console.error('Error fetching category:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get category by statement ID
     * @param {string} stmt_id - Statement ID
     * @returns {Promise<object>} Category record for the statement
     */
    static async getByStatementId(stmt_id) {
        try {
            const category = await Categories.findOne({
                where: { stmt_id },
            });
            if (!category) {
                return {
                    success: false,
                    error: `No category found for statement: ${stmt_id}`,
                };
            }
            return {
                success: true,
                data: category,
            };
        } catch (error) {
            console.error('Error fetching category:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get all categories for a user
     * @param {string} user_id - User ID
     * @returns {Promise<object>} Array of category records
     */
    static async getByUserId(user_id) {
        try {
            const categories = await Categories.findAll({
                where: { user_id },
                order: [['created_at', 'DESC']],
            });
            return {
                success: true,
                data: categories,
                count: categories.length,
            };
        } catch (error) {
            console.error('Error fetching categories:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get total summary across all categories for a user
     * @param {string} user_id - User ID
     * @returns {Promise<object>} Aggregated totals
     */
    static async getUserSummary(user_id) {
        try {
            const categories = await Categories.findAll({
                where: { user_id },
            });

            const summary = {
                savings: 0,
                shopping_merc: 0,
                food_orders: 0,
                bills: 0,
                transfers: 0,
                salary: 0,
                others: 0,
            };

            categories.forEach((category) => {
                summary.savings += parseFloat(category.savings) || 0;
                summary.shopping_merc += parseFloat(category.shopping_merc) || 0;
                summary.food_orders += parseFloat(category.food_orders) || 0;
                summary.bills += parseFloat(category.bills) || 0;
                summary.transfers += parseFloat(category.transfers) || 0;
                summary.salary += parseFloat(category.salary) || 0;
                summary.others += parseFloat(category.others) || 0;
            });

            return {
                success: true,
                data: summary,
                categoryCount: categories.length,
            };
        } catch (error) {
            console.error('Error calculating user summary:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete a category
     * @param {number} id - Category ID to delete
     * @returns {Promise<object>} Deletion result
     */
    static async delete(id) {
        const transaction = await sequelize.transaction();
        try {
            if (!id) {
                throw new Error('id is required');
            }

            const deleted = await Categories.destroy(
                { where: { id } },
                { transaction }
            );

            await transaction.commit();

            if (deleted === 0) {
                return {
                    success: false,
                    error: `No category found to delete: ${id}`,
                };
            }

            console.log(`Category deleted successfully: ${id}`);
            return {
                success: true,
                message: 'Category deleted successfully',
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting category:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete category by statement ID
     * @param {string} stmt_id - Statement ID
     * @returns {Promise<object>} Deletion result
     */
    static async deleteByStatementId(stmt_id) {
        const transaction = await sequelize.transaction();
        try {
            if (!stmt_id) {
                throw new Error('stmt_id is required');
            }

            const deleted = await Categories.destroy(
                { where: { stmt_id } },
                { transaction }
            );

            await transaction.commit();

            console.log(`Category deleted for statement: ${stmt_id}`);
            return {
                success: true,
                message: 'Category deleted successfully',
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting category:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = CategoriesController;
