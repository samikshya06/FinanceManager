require('dotenv').config();
const express = require('express');
const path = require('path');
const { upload, processStatement } = require('./services/uploadAndProcessService');
const SQSService = require('./services/sqsService');
const LLMInsightsService = require('./services/llmInsightsService');
const { sequelize } = require('./models');
const UsersController = process.env.USE_DYNAMODB === 'true' ? require('./dynamoDBControllers/UsersController') : require('./dbControllers/UserController');
const StatementsController = process.env.USE_DYNAMODB === 'true' ? require('./dynamoDBControllers/StatementsController') : require('./dbControllers/StatementController');
const CategoriesController = process.env.USE_DYNAMODB === 'true' ? require('./dynamoDBControllers/CategoriesController') : require('./dbControllers/CategoriesController');
const TransactionsController = process.env.USE_DYNAMODB === 'true' ? require('./dynamoDBControllers/TransactionsController') : require('./dbControllers/TransactionController');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const sqsService = new SQSService();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAME_TO_NUMBER = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};

function getSessionUser(user) {
    if (!user || !user.user_id) return null;

    return {
        user_id: user.user_id,
        name: user.name || null,
        email: user.email || null,
    };
}

function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const index = part.indexOf('=');
            if (index === -1) return acc;
            const key = part.slice(0, index);
            const value = part.slice(index + 1);
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    const cookies = parseCookies(req.headers.cookie || '');
    return cookies.auth_token || null;
}

function verifyJwtFromRequest(req) {
    const token = getTokenFromRequest(req);
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return getSessionUser(decoded);
    } catch (error) {
        return null;
    }
}

function issueAuthToken(res, user) {
    const safeUser = getSessionUser(user);
    if (!safeUser) return null;

    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
    });

    return safeUser;
}

function requireAuth(req, res, next) {
    const user = verifyJwtFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    req.user = user;
    return next();
}

function parseStatementPeriod(stmtId, userId) {
    const prefix = `${userId}_`;
    if (!stmtId || !stmtId.startsWith(prefix)) return null;

    const datePart = stmtId.substring(prefix.length);
    const match = datePart.match(/^([A-Za-z]+)(\d{4})$/);
    if (!match) return null;

    const monthName = match[1];
    const monthNumber = MONTH_NAME_TO_NUMBER[monthName.toLowerCase()];
    if (!monthNumber) return null;

    return {
        month: String(monthNumber).padStart(2, '0'),
        year: match[2],
        monthName,
    };
}

// Initialize database
(async () => {
    try {
        await sequelize.sync({ force: false });
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Database synchronization failed:', error);
        process.exit(1);
    }
})();

// Feature flag to enable/disable SQS (default: disabled for backward compatibility)
const USE_SQS = process.env.USE_SQS === 'true';

// Passport configuration
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
         console.log("local OAuth profile:", email, password);
       const result = await UsersController.authenticate(email, password);
        if (result.success) {
            return done(null, result.data);
        } else {
            return done(null, false, { message: result.error });
        }
    } catch (error) {
        return done(error);
    }
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        /**
         * Finds an existing OAuth user or creates a new one based on the provided profile
         * @async
         * @param {Object} profile - The OAuth profile object from the authentication provider
         * @returns {Promise<Object>} A promise that resolves to the user object
         * @throws {Error} If there's an error finding or creating the user
         */
       
        const result = await UsersController.findOrCreateOAuthUser(profile);
        if (result.success) {
            return done(null, result.data);
        } else {
            return done(null, false, { message: result.error });
        }
    } catch (error) {
        return done(error);
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
      console.log("User is , serving dashboard");
    const user = verifyJwtFromRequest(req);
    if (user) {
        console.log("User is authenticated, serving dashboard");
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Or create a separate login page
});

// Authentication routes
app.post('/api/login', (req, res, next) => {
    console.log("Login attempt with email:", req.body.email);
    passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ success: false, error: info && info.message ? info.message : 'Login failed' });
        const safeUser = issueAuthToken(res, user);
        if (!safeUser) {
            return res.status(500).json({ success: false, error: 'Failed to create auth token' });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: safeUser
        });
    })(req, res, next);
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        issueAuthToken(res, req.user);
        res.redirect('/dashboard');
    }
);

app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ success: true, message: 'Logout successful' });
});

app.get('/api/user', requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

app.get('/api/statements/available-periods', requireAuth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const stmtResult = await StatementsController.getByUserId(userId);

        if (!stmtResult.success) {
            return res.status(500).json({ success: false, error: stmtResult.error || 'Failed to fetch statements' });
        }

        const periodMap = new Map();
        for (const statement of stmtResult.data) {
            const parsed = parseStatementPeriod(statement.stmt_id, userId);
            if (!parsed) continue;

            const key = `${parsed.year}-${parsed.month}`;
            if (!periodMap.has(key)) {
                periodMap.set(key, {
                    month: parsed.month,
                    year: parsed.year,
                    label: `${parsed.monthName} ${parsed.year}`,
                    stmt_id: statement.stmt_id,
                });
            }
        }

        const periods = Array.from(periodMap.values()).sort((a, b) => {
            if (a.year !== b.year) return Number(b.year) - Number(a.year);
            return Number(b.month) - Number(a.month);
        });

        return res.json({ success: true, data: periods });
    } catch (error) {
        console.error('Error fetching available statement periods:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch available periods' });
    }
});

app.get('/api/statements/data', requireAuth, async (req, res) => {
    try {
        const { month, year } = req.query;
        const monthNumber = Number(month);

        if (!month || !year || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12 || !/^\d{4}$/.test(year)) {
            return res.status(400).json({ success: false, error: 'Valid month and year are required' });
        }

        const userId = req.user.user_id;
        const date = `${MONTH_NAMES[monthNumber]}${year}`;
        const stmtId = `${userId}_${date}`;

        const catResult = await CategoriesController.getByStatementId(stmtId);
        if (!catResult.success) {
            return res.status(404).json({ success: false, error: 'No data found for selected month and year' });
        }

        return res.json({
            success: true,
            data: {
                stmt_id: stmtId,
                categories: catResult.data,
            }
        });
    } catch (error) {
        console.error('Error fetching statement data by period:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch statement data' });
    }
});

// API endpoint for file upload and processing
app.post('/api/upload', upload.single('pdfFile'), async (req, res) => {
    try {
        const user = verifyJwtFromRequest(req);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        req.user = user;

        // Check if file exists
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const userId = req.user.user_id; // Use authenticated user
        const { month, year } = req.body;

        // Create date string (e.g., "November2025")
        const date = `${MONTH_NAMES[parseInt(month)]}${year}`;

        // Use SQS for async processing if enabled, otherwise process synchronously
        if (USE_SQS) {
            // Send job to SQS queue for async processing
            const jobData = {
                filePath: req.file.path,
                date: date,
                userId: userId,
                fileName: req.file.originalname
            };

            // this data needs to be persisted in db for later retrieval and display in dashboard, for now we are just sending it to SQS
            const sqsResult = await sqsService.sendPDFProcessingJob(jobData);

            if (!sqsResult.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to queue PDF processing job',
                    details: sqsResult.error
                });
            }

            // Return immediate response - processing happens in background
            return res.json({
                success: true,
                message: 'Statement uploaded and queued for processing',
                data: {
                    jobId: sqsResult.messageId,
                    status: 'queued',
                    stmt_id: `${userId}_${date}`
                }
            });
        } else {
            // Original synchronous processing
            const result = await processStatement(req.file.path, date, userId);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to process PDF',
                    details: result.error
                });
            }

            // Return success response with processed data
            res.json({
                success: true,
                message: 'Statement processed successfully',
                data: {
                    categories: result.categories,
                    transactions: result.transactions,
                    stmt_id: result.stmt_id
                }
            });
        }

    } catch (error) {
        console.error('Upload error:', error);
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds 5MB limit'
            });
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint for LLM spending insights (last 3 months)
app.get('/api/insights', async (req, res) => {
    const user = verifyJwtFromRequest(req);
    if (!user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = user;

    const userId = req.user.user_id;

    try {
        const stmtResult = await StatementsController.getByUserId(userId);
        if (!stmtResult.success || stmtResult.data.length === 0) {
            return res.status(400).json({ success: false, error: 'No statements found. Please upload at least 3 months of bank statements.' });
        }

        // Take up to 3 most recent statements (already ordered DESC by created_at)
        const recent = stmtResult.data.slice(0, 3);
        if (recent.length < 3) {
            return res.status(400).json({ success: false, error: `Only ${recent.length} month(s) of data found. Insights require at least 3 months.` });
        }

        // Reverse so monthlyData is chronological (oldest → newest)
        const chronological = [...recent].reverse();

        const monthlyData = [];
        for (const stmt of chronological) {
            const catResult = await CategoriesController.getByStatementId(stmt.stmt_id);
            if (!catResult.success) {
                return res.status(500).json({ success: false, error: `Missing category data for statement: ${stmt.stmt_id}` });
            }

            const c = catResult.data;
            // Parse label from stmt_id: "{userId}_{MonthName}{Year}" → "MonthName Year"
            const datePart = stmt.stmt_id.substring(stmt.stmt_id.indexOf('_') + 1);
            const match = datePart.match(/^([A-Za-z]+)(\d{4})$/);
            const label = match ? `${match[1]} ${match[2]}` : datePart;

            monthlyData.push({
                label,
                shopping_merc: parseFloat(c.shopping_merc) || 0,
                food_orders:   parseFloat(c.food_orders)   || 0,
                bills:         parseFloat(c.bills)         || 0,
                transfers:     parseFloat(c.transfers)     || 0,
                other:         parseFloat(c.others)        || 0,
                salary:        parseFloat(c.salary)        || 0,
                savings:       parseFloat(c.savings)       || 0,
            });
        }

        const llm = new LLMInsightsService();
        const insights = await llm.analyzeSpending(monthlyData);

        res.json({ success: true, insights });

    } catch (error) {
        console.error('Insights error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint for user registeration
app.post('/api/register', async (req, res) => {
    try {
        const { userId, name, email, password } = req.body; 
        if (!userId || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'User ID, name, email, and password are required'
            });
        }
        // Create new user using UsersController
        const result = await UsersController.register(userId, name, email, password);
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: {
                    user_id: result.data.user_id
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred during registration'
        });
    }

});

// API endpoint for user login
// app.post('/api/login', async (req, res) => {
//     try {
//         const { email, password } = req.body;   
//         if (!email || !password) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Email and password are required'
//             });
//         }
//         // Authenticate user using UsersController
//         const result = await UsersController.authenticate(email, password);
//         if (result.success) {
//             res.json({
//                 success: true,
//                 message: result.message,
//                 data: result.data
//             });
//         } else {
//             res.status(401).json({
//                 success: false,
//                 error: result.error
//             });
//         }
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'An error occurred during login'
//         });
//     }
// });

// Error handling middleware for multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds 5MB limit'
            });
        }
    }
    
    if (error.message === 'Only PDF files are allowed!') {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'An error occurred during file upload'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Upload endpoint: POST /upload');
    console.log('Max file size: 5MB');
    console.log('Allowed file type: PDF');
});
