const { User, sequelize } = require('../models');
const bcrypt = require('bcrypt');

/**
 * UserController
 * Handles database operations for User model
 */
class UserController {
    /**
     * Hash a password using bcrypt
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    static async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }

    /**
     * Verify password against hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {Promise<boolean>} Password match result
     */
    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    /**
     * Create a new user
     * @param {string} user_id - Unique user identifier
     * @param {string} name - User's full name
     * @param {string} email - User's email address
     * @param {string} password - Plain text password (will be hashed)
     * @returns {Promise<object>} Created user record
     */
    static async create(user_id,name, email, password) {
        const transaction = await sequelize.transaction();
        try {
            if (!user_id || !name || !email || !password) {
                throw new Error('All fields (user_id, name, email, password) are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }

            // Check if user already exists
            const existingUser = await User.findOne(
                { where: { email } },
                { transaction }
            );
            if (existingUser) {
                await transaction.rollback();
                return {
                    success: false,
                    error: `User with email already exists: ${email}`,
                    message: 'Email already registered',
                };
            }

            // Hash password
            const hashedPassword = await this.hashPassword(password);

            const user = await User.create(
                {
                    user_id,
                    name,
                    email,
                    password: hashedPassword,
                    createdAt: new Date()
                },
                { transaction }
            );

            await transaction.commit();
            console.log(`User created successfully: ${user_id}`);

            // Return user without password
            const userResponse = user.toJSON();
            delete userResponse.password;

            return {
                success: true,
                data: userResponse,
                message: 'User created successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error creating user:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create user',
            };
        }
    }

    /**
     * Register a new user
     * @param {string} name - User's full name
     * @param {string} email - User's email address
     * @param {string} password - Plain text password
     * @returns {Promise<object>} Registration result
     */
    static async register(userId,name, email, password) {
        // const user_id = `user_${Date.now()}`;
        return await this.create(userId, name, email, password);
    }

    /**
     * Update user information
     * @param {string} user_id - User ID to update
     * @param {object} updateData - Data to update (name, email, password)
     * @returns {Promise<object>} Updated user record
     */
    static async update(user_id, updateData) {
        const transaction = await sequelize.transaction();
        try {
            if (!user_id) {
                throw new Error('user_id is required');
            }

            const user = await User.findByPk(user_id, { transaction });
            if (!user) {
                throw new Error(`User not found: ${user_id}`);
            }

            // Validate email if being updated
            if (updateData.email && updateData.email !== user.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(updateData.email)) {
                    throw new Error('Invalid email format');
                }

                // Check if new email already exists
                const existingUser = await User.findOne(
                    { where: { email: updateData.email } },
                    { transaction }
                );
                if (existingUser) {
                    throw new Error(`Email already in use: ${updateData.email}`);
                }
            }

            // Hash password if being updated
            if (updateData.password) {
                updateData.password = await this.hashPassword(updateData.password);
            }

            const updated = await user.update(updateData, { transaction });
            await transaction.commit();

            console.log(`User updated successfully: ${user_id}`);

            // Return user without password
            const userResponse = updated.toJSON();
            delete userResponse.password;

            return {
                success: true,
                data: userResponse,
                message: 'User updated successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error updating user:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update user',
            };
        }
    }

    /**
     * Get user by ID
     * @param {string} user_id - User ID
     * @param {boolean} includePassword - Include password in response (default: false)
     * @returns {Promise<object>} User record
     */
    static async getById(user_id, includePassword = false) {
        try {
            console.log('[UserController.getById] Looking up user_id:', user_id);
            const user = await User.findByPk(user_id);
            if (!user) {
                console.log('[UserController.getById] User not found:', user_id);
                return {
                    success: false,
                    error: `User not found: ${user_id}`,
                };
            }

            const userResponse = user.toJSON();
            if (!includePassword) {
                delete userResponse.password;
            }

            console.log('[UserController.getById] User found:', userResponse);
            return {
                success: true,
                data: userResponse,
            };
        } catch (error) {
            console.error('Error fetching user:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Get user by email
     * @param {string} email - User email
     * @param {boolean} includePassword - Include password in response (default: false)
     * @returns {Promise<object>} User record
     */
    static async getByEmail(email, includePassword = false) {
        try {
            const user = await User.findOne({
                where: { email },
            });
            if (!user) {
                return {
                    success: false,
                    error: `User not found: ${email}`,
                };
            }

            const userResponse = user.toJSON();
            if (!includePassword) {
                delete userResponse.password;
            }

            return {
                success: true,
                data: userResponse,
            };
        } catch (error) {
            console.error('Error fetching user by email:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Authenticate user with email and password
     * @param {string} email - User email
     * @param {string} password - Plain text password
     * @returns {Promise<object>} Authentication result with user data
     */
    static async authenticate(email, password) {
        console.log(`Authenticating user with email: ${email}`);
        try {
            if (!email || !password) {
                return {
                    success: false,
                    error: 'Email and password are required',
                };
            }

            const user = await User.findOne({
                where: { email },
            });
            if (!user) {
                return {
                    success: false,
                    error: 'Invalid email or password',
                };
            }

            // Verify password
            if (!(await this.verifyPassword(password, user.password))) {
                return {
                    success: false,
                    error: 'Invalid email or password',
                };
            }

            const userResponse = user.toJSON();
            delete userResponse.password;

            return {
                success: true,
                data: userResponse,
                message: 'Authentication successful',
            };
        } catch (error) {
            console.error('Error authenticating user:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Find or create user for OAuth (Google)
     * @param {object} profile - OAuth profile
     * @returns {Promise<object>} User record
     */
    static async findOrCreateOAuthUser(profile) {
        const transaction = await sequelize.transaction();
        try {
            const { id, displayName, emails } = profile;
            const email = emails[0].value;

            // Check if user exists by googleId
            let user = await User.findOne({
                where: { googleId: id },
                transaction
            });

            if (user) {
                await transaction.commit();
                const userResponse = user.toJSON();
                delete userResponse.password;
                return {
                    success: true,
                    data: userResponse,
                    message: 'User found',
                };
            }

            // Check if user exists by email
            user = await User.findOne({
                where: { email },
                transaction
            });

            if (user) {
                // Update with googleId
                user.googleId = id;
                await user.save({ transaction });
                await transaction.commit();
                const userResponse = user.toJSON();
                delete userResponse.password;
                return {
                    success: true,
                    data: userResponse,
                    message: 'User updated with Google ID',
                };
            }

            // Create new user
            const userId = `user_${Date.now()}`;
            user = await User.create({
                user_id: userId,
                name: displayName,
                email,
                googleId: id,
                password: null, // No password for OAuth users
            }, { transaction });

            await transaction.commit();
            console.log(`OAuth user created successfully: ${userId}`);

            const userResponse = user.toJSON();
            delete userResponse.password;

            return {
                success: true,
                data: userResponse,
                message: 'OAuth user created successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error finding or creating OAuth user:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to authenticate with OAuth',
            };
        }
    }

    /**
     * Get all users (paginated)
     * @param {number} limit - Number of records to fetch (default: 10)
     * @param {number} offset - Number of records to skip (default: 0)
     * @returns {Promise<object>} Array of users
     */
    static async getAll(limit = 10, offset = 0) {
        try {
            const { count, rows } = await User.findAndCountAll({
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                attributes: { exclude: ['password'] }, // Never include passwords in list
            });

            return {
                success: true,
                data: rows,
                count,
                limit,
                offset,
            };
        } catch (error) {
            console.error('Error fetching users:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Change user password
     * @param {string} user_id - User ID
     * @param {string} currentPassword - Current plain text password
     * @param {string} newPassword - New plain text password
     * @returns {Promise<object>} Update result
     */
    static async changePassword(user_id, currentPassword, newPassword) {
        const transaction = await sequelize.transaction();
        try {
            if (!user_id || !currentPassword || !newPassword) {
                throw new Error('user_id, currentPassword, and newPassword are required');
            }

            if (currentPassword === newPassword) {
                throw new Error('New password must be different from current password');
            }

            const user = await User.findByPk(user_id, { transaction });
            if (!user) {
                throw new Error(`User not found: ${user_id}`);
            }

            // Verify current password
            if (!this.verifyPassword(currentPassword, user.password)) {
                throw new Error('Current password is incorrect');
            }

            // Update with new hashed password
            const hashedPassword = this.hashPassword(newPassword);
            await user.update({ password: hashedPassword }, { transaction });
            await transaction.commit();

            console.log(`Password changed successfully for user: ${user_id}`);
            return {
                success: true,
                message: 'Password changed successfully',
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error changing password:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Delete a user
     * @param {string} user_id - User ID to delete
     * @returns {Promise<object>} Deletion result
     */
    static async delete(user_id) {
        const transaction = await sequelize.transaction();
        try {
            if (!user_id) {
                throw new Error('user_id is required');
            }

            const deleted = await User.destroy(
                { where: { user_id } },
                { transaction }
            );

            await transaction.commit();

            if (deleted === 0) {
                return {
                    success: false,
                    error: `No user found to delete: ${user_id}`,
                };
            }

            console.log(`User deleted successfully: ${user_id}`);
            return {
                success: true,
                message: 'User deleted successfully',
                deletedCount: deleted,
            };
        } catch (error) {
            await transaction.rollback();
            console.error('Error deleting user:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check if email exists
     * @param {string} email - Email to check
     * @returns {Promise<object>} Existence result
     */
    static async emailExists(email) {
        try {
            const user = await User.findOne({
                where: { email },
            });
            return {
                success: true,
                exists: !!user,
                email,
            };
        } catch (error) {
            console.error('Error checking email existence:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check if user_id exists
     * @param {string} user_id - User ID to check
     * @returns {Promise<object>} Existence result
     */
    static async userIdExists(user_id) {
        try {
            const user = await User.findByPk(user_id);
            return {
                success: true,
                exists: !!user,
                user_id,
            };
        } catch (error) {
            console.error('Error checking user_id existence:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = UserController;
