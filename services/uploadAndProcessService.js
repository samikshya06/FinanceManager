const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TransactionParser = require('./transactionParser');
const parser = new TransactionParser();
const { Statement, Transaction, Categories } = require('../models'); // Updated to use Sequelize models

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for PDF validation
/**
 * Multer file filter function to validate uploaded files.
 * Only allows PDF files based on MIME type and file extension.
 * 
 * @param {Object} req - Express request object (unused but required by Multer signature)
 * @param {Object} file - Multer file object containing file information
 * @param {string} file.originalname - Original name of the uploaded file
 * @param {string} file.mimetype - MIME type of the uploaded file
 * @param {Function} cb - Callback function to signal acceptance or rejection of the file
 * @param {Error|null} cb.error - Error object if file is rejected, null if accepted
 * @param {boolean} cb.accept - true to accept the file, false to reject it
 */
const fileFilter = (req, file, cb) => {
    // Check file type
    const allowedMimeTypes = ['application/pdf'];
    const allowedExtensions = ['.pdf'];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;
    
    if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(fileExtension)) {
        cb(null, true); // this will tell multer to accept the file
    } else {
        cb(new Error('Only PDF files are allowed!'), false); // this is to reject the file
    }
};

// Configure multer with file size limit (5MB)
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB in bytes
    },
    fileFilter: fileFilter
});

// Function to process statement and return categorized data
async function processStatement(filePath, date, userId) {
    try {
        // this will provide us the data with extracted transactions
        const stmt_id = `${userId}_${date}`; //sam12_March2025
        const status = "pending";
        // enter into statements table stmt_id, status ="pending", created_at
        await Statement.create({
            stmt_id: stmt_id,
            user_id: userId,
            status: status,
            created_at: new Date()
        });

        // Parse PDF
        const data = await parser.parsePDF(filePath, stmt_id, userId);
        console.log(`PDF parsing completed for ${filePath}. Extracted ${data.transactions.length} transactions.`);
        // console.log(`Extracted transactions:`, data.transactions);
        if (!data.success) {
            return {
                success: false,
                error: 'Failed to parse PDF'
            };
        }
        
        // console.log(`PDF parsed successfully. Number of transactions: ${data.transactions.length}`);
        
        // Categorize transactions
        const categories = parser.categorizeTransactions(data.transactions);
        // console.log(`Transactions categorized:`, categories);
        
        // Save and updateto database
        await Statement.update(
            { status: 'Completed' },
            { where: { stmt_id: stmt_id } }
        );
       
        await Transaction.bulkCreate(data.transactions.map(tr => ({
            stmt_id: stmt_id,
            transaction: tr.description,
            tr_amt: tr.amount,
            tr_date: tr.date,
            trans_type: tr.type
        })));   

        await Categories.create({
            user_id: userId,
            stmt_id: stmt_id,
            savings: categories.savings || 0,
            shopping: categories.shopping || 0,
            bills: categories.bills || 0,
            transfers: categories.transfers || 0,
            salary: categories.salary || 0,
            others: categories.others || 0,
            created_at: new Date()
        });
        
        return {
            success: true,
            stmt_id: stmt_id,
            categories: categories,
            transactions: data.transactions,
            metadata: data.metadata
        };
    } catch (error) {
        console.error('Error processing statement:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    upload,
    processStatement
};
