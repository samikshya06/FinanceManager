
const pdfParse = require('pdf-parse');
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
const { type } = require('os');
// const db = require('./models/db'); // Adjust path to your database module
// Disable worker to avoid issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * Transaction Parser Service
 * Extracts only transaction data from bank statement PDFs
 */

class TransactionParser {
    constructor() {
        // Common patterns for filtering out non-transaction lines
        this.excludePatterns = [
            /^(bank|branch|address|phone|email|website|customer|account holder)/i,
            /^(statement|period|from|to|opening balance|closing balance)/i,
            /^(page \d+|continued|total)/i,
            /^\s*$/,  // Empty lines
            /^(ifsc|swift|micr|pan|gstin)/i,
            /^(registered office|corporate office)/i,
            /^(dear|sir|madam)/i
        ];

        // Transaction pattern: Date + Description + Amount
        // Example: "25/12/2024    ATM Withdrawal    -500.00"
        this.transactionPattern = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\-\+]?\d+[,\.]?\d*\.?\d{0,2})$/;

        // Alternative pattern with separate debit/credit columns
        // Example: "25/12/2024    Shopping    500.00        5000.00"
        this.transactionPatternWithBalance = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,\.]+)?\s*([\d,\.]+)?\s+([\d,\.]+)$/;

        // ACH transaction pattern: Date + Description + Reference + ValueDate + Amount + Balance
        // Example: "10/04/23   ACH D- GROWW-HVJUMZ8L5K42   0000000672536142   10/04/23   3,000.00   177,386.19"
        this.achTransactionPattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s{3}(.+?)\s{3}(\d{16})\s{3}(\d{1,2}\/\d{1,2}\/\d{2,4})\s{3}([\d,]+\.\d{2})\s{3}([\d,]+\.\d{2})$/;
    }

    /**
     * Parse PDF and extract transactions
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<Object>} Parsed transactions
     */
    async parsePDF(pdfPath, stmt_id, userId) {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
console.log(`Data buffer length: ${dataBuffer.length}`);
            // Try the advanced PDF.js parser first
            try {
                 // db.Statement.create(stmt_id, userId, 'In Progress');
                const textWithStructure = await this.parsePDFWithStructure(dataBuffer);
                // console.log(`Data from pdf: ${textWithStructure}`);
               
                const transactions = this.extractTransactionsFromStructuredText(textWithStructure);
                // need to add into transactions table
                // transactions.forEach(async (txn) => {
                //     await db.Transaction.create(stmt_id, txn.description, txn.amount, txn.date);
                // });
                if (transactions.length > 0) {
                    return {
                        success: true,
                        transactions: transactions,
                        totalCount: transactions.length,
                        metadata: {
                            parser: 'pdfjs',
                            extractedLines: textWithStructure.length
                        }
                    };
                }
            } catch (pdfJsError) {
                console.log('PDF.js parsing failed, falling back to pdf-parse:', pdfJsError.message);
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse PDF with structure preservation using PDF.js
     * @param {Buffer} dataBuffer - PDF file buffer
     * @returns {Promise<Array>} Array of structured text lines
     */
    async parsePDFWithStructure(dataBuffer) {
        try {
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(dataBuffer),
                useSystemFonts: true,
                standardFontDataUrl: null
            });

            const pdf = await loadingTask.promise;
            console.log('Loading PDF with PDF.js...');
            console.log(`Number of pages: ${pdf.numPages}`);
            const allLines = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Group text items by their Y coordinate (row)
                const rowMap = new Map();

                textContent.items.forEach(item => {
                    const y = Math.round(item.transform[5]); // Y coordinate
                    const x = Math.round(item.transform[4]); // X coordinate

                    if (!rowMap.has(y)) {
                        rowMap.set(y, []);
                    }

                    rowMap.get(y).push({
                        text: item.str,
                        x: x,
                        y: y
                    });
                });

                // Sort rows by Y coordinate (top to bottom)
                const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);

                // For each row, sort items by X coordinate and join them
                sortedYs.forEach(y => {
                    const items = rowMap.get(y).sort((a, b) => a.x - b.x);
                    const line = items.map(item => item.text).join(' ');
                    if (line.trim()) {
                        allLines.push(line.trim());
                    }
                });
            }

            return allLines;
        } catch (error) {
            console.error('Error parsing PDF with structure:', error.message);
            throw error;
        }
    }

    /**
     * Extract transactions from structured text lines
     * @param {Array} lines - Array of text lines from PDF with preserved structure
     * @returns {Array} Array of transaction objects
     */
    extractTransactionsFromStructuredText(lines) {
        const transactions = [];
        let inTransactionSection = false;
console.log(lines[29]);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip excluded patterns
            if (this.shouldExcludeLine(line)) {
                continue;
            }

            // Detect start of transaction section and skip it
            if (this.isTransactionHeaderLine(line)) {
                inTransactionSection = true;
                continue;
            }

            // Try to parse transaction
            if (inTransactionSection) {
                // console.log("Processing line: ", line);
                const transaction = this.parseTransactionLine(line);
                if (transaction) {
                    // Check for continuation lines (multi-line descriptions)
                    let continuationText = '';
                    let j = i + 1;
                    
                    while (j < lines.length) {
                        const nextLine = lines[j].trim();
                        
                        // Stop if we hit an excluded line or empty line
                        if (this.shouldExcludeLine(nextLine)) {
                            break;
                        }
                        
                        // Stop if next line is a header
                        if (this.isTransactionHeaderLine(nextLine)) {
                            break;
                        }
                        
                        // Stop if next line is a new transaction (starts with date)
                        if (this.startsWithDate(nextLine)) {
                            break;
                        }
                        
                        // This is a continuation line - accumulate it
                        continuationText += ' ' + nextLine;
                        j++;
                        i++; // Skip this line in the main loop
                    }
                    
                    // Append continuation text to description if found
                    if (continuationText) {
                        console.log(`Found continuation for transaction: ${transaction.description}. Continuation text: ${continuationText}`);
                        transaction.description += continuationText;
                        transaction.description = transaction.description.trim();
                    }
                    
                    transactions.push(transaction);
                }
            }
        }

        return transactions;
    }

    /**
     * Check if line should be excluded
     * @param {string} line - Text line
     * @returns {boolean}
     */
    shouldExcludeLine(line) {
        if (!line || line.length < 5) return true;

        return this.excludePatterns.some(pattern => pattern.test(line));
    }

    /**
     * Check if line is a transaction section header
     * @param {string} line - Text line
     * @returns {boolean}
     */
    isTransactionHeaderLine(line) {
        const headerPatterns = [
            /^(date|transaction|description|debit|credit|balance)/i,
            /^(txn date|value date|particulars)/i
        ];

        return headerPatterns.some(pattern => pattern.test(line));
    }

    /**
     * Check if line starts with a date pattern
     * @param {string} line - Text line
     * @returns {boolean}
     */
    startsWithDate(line) {
        const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
        return datePattern.test(line);
    }

    /**
     * Parse a single transaction line
     * @param {string} line - Text line
     * @returns {Object|null} Transaction object or null
     */
    parseTransactionLine(line) {
        // Try ACH pattern first (most specific): Date + Description + Reference + ValueDate + Amount + Balance
        let match = line.match(this.achTransactionPattern);
        if (match) {
            const transactionDate = match[1];
            const description = match[2].trim();
            const reference = match[3];
            const valueDate = match[4];
            const amount = parseFloat(match[5].replace(/,/g, ''));
            const balance = parseFloat(match[6].replace(/,/g, ''));

            // Determine transaction type from description
            const descUpper = description.toUpperCase();
            const isCredit = descUpper.includes('NEFT CR') || descUpper.includes('ACH C-') || 
                           descUpper.includes('CREDIT') || descUpper.includes('REFUND');
            const isDebit = descUpper.includes('NEFT DR') || descUpper.includes('ACH D-') || 
                          descUpper.includes('UPI-') || descUpper.includes('DEBIT');
            const type = isCredit ? 'Credit' : isDebit ? 'Debit' : 'None';

            return {
                date: this.parseDate(transactionDate),
                description: description,
                amount: type === 'Credit' ? amount : -amount,
                balance: balance,
                type: type,
                reference: reference,
                valueDate: this.parseDate(valueDate),
                rawLine: line
            };
        }

        // Try pattern 1: Date + Description + Amount (simple format)
        match = line.match(this.transactionPattern);
        let type = 'None';
        if (match) {
            const currBalance = match[3];
            const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
            const descriptionParts = match[2].trim().split(datePattern);
            const desc = descriptionParts[0].toUpperCase();
            const isCredit = desc.includes('NEFT CR') || desc.includes('ACH C-') || 
                           desc.includes('CREDIT') || desc.includes('REFUND');
            const isDebit = desc.includes('NEFT DR') || desc.includes('ACH D-') || 
                          desc.includes('UPI-') || desc.includes('DEBIT');
            type = isCredit ? 'Credit' : isDebit ? 'Debit' : 'None';
       
            return {
                date: this.parseDate(match[1]),
                description: descriptionParts[0].trim(),
                amount: parseFloat(descriptionParts[1]?.replace(/,/g, '') || 0),
                balance: parseFloat(currBalance.replace(/,/g, '')),
                type: type,
                rawLine: line
            };
        }

        return null;
    }

    /**
     * Parse date string to Date object
     * @param {string} dateStr - Date string
     * @returns {Date}
     */
    parseDate(dateStr) {
        // Handle different date formats: DD/MM/YYYY, DD-MM-YYYY, etc.
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
            return new Date(year, month, day);
        }
        return new Date(dateStr);
    }

    /**
     * Advanced parsing with custom rules
     * @param {string} pdfPath - Path to PDF file
     * @param {Object} options - Custom parsing options
     * @returns {Promise<Object>}
     */

    /**
     * Filter transactions by date range
     * @param {Array} transactions - Array of transactions
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array}
     */
    filterByDateRange(transactions, startDate, endDate) {
        return transactions.filter(txn => {
            const txnDate = new Date(txn.date);
            return txnDate >= startDate && txnDate <= endDate;
        });
    }

    /**
     * Filter transactions by amount range
     * @param {Array} transactions - Array of transactions
     * @param {number} minAmount - Minimum amount
     * @param {number} maxAmount - Maximum amount
     * @returns {Array}
     */
    filterByAmountRange(transactions, minAmount, maxAmount) {
        return transactions.filter(txn => {
            const amount = Math.abs(txn.amount);
            return amount >= minAmount && amount <= maxAmount;
        });
    }

    /**
     * Categorize transactions
     * @param {Array} transactions - Array of transactions
     * @returns {Object}
     */
    categorizeTransactions(transactions) {
        // console.log(`transactions data: ${JSON.stringify(transactions)}`);
        const categories = {
            savings: 0,
            shopping_merc: 0,
            food_orders:0,
            bills: 0,
            transfers: 0,
            salary: 0,
            other: 0
        };

        const categoryPatterns = {
            savings: /groww|zerodha|kite|mutual fund|sip|investment/i,
            shopping_merc: /amazon|flipkart|myntra|shopping|store|mall/i,
            food_orders: /swiggy|zomato/i,
            bills: /electricity|water|phone|internet|gas|insurance|lic/i,
            transfers: /neft dr|imps dr|rtgs dr|transfer/i,
            salary: /salary|wipro|geheal|income|stipend|payroll/i
        };

        transactions.forEach(txn => {
            // const desc = txn.description.toUpperCase();
            const isCredit = txn.type === 'Credit' ;
            const isDebit = txn.type === 'Debit';
            let categorized = false;
            
            // Salary: only count credits (money coming in)
            if (categoryPatterns.salary.test(txn.description) && isCredit) {
                categories.salary += Math.abs(txn.amount);
                categorized = true;
            }
            // Savings: only count debits (money going out to investments)
            else if (categoryPatterns.savings.test(txn.description) && isDebit) {
                categories.savings += Math.abs(txn.amount);
                categorized = true;
            }
            // Shopping merchandise ecommerce: only count debits (money spent)
            else if (categoryPatterns.shopping_merc.test(txn.description) && isDebit) {
                categories.shopping_merc += Math.abs(txn.amount);
                categorized = true;
            }
              // food orders: only count debits (money spent)
            else if (categoryPatterns.food_orders.test(txn.description) && isDebit) {
                categories.food_orders += Math.abs(txn.amount);
                categorized = true;
            }
            // Bills: only count debits (money paid for bills)
            else if (categoryPatterns.bills.test(txn.description) && isDebit) {
                categories.bills += Math.abs(txn.amount);
                categorized = true;
            }
            // Transfers: only count debits (money transferred out)
            else if (categoryPatterns.transfers.test(txn.description) && isDebit) {
                categories.transfers += Math.abs(txn.amount);
                categorized = true;
            }
            
            // Other: any remaining debits
            if (!categorized && isDebit) {
                categories.other += Math.abs(txn.amount);
            }
        });

        return categories;
    }

    /**
     * Analyze category spending trends over 3 statements
     * @param {Array<string>} statementIds - Array of 3 statement IDs in order (oldest to newest)
     * @param {Function} getCategoriesByStatementId - async function(stmtId) => category totals object
     * @returns {Promise<Array>} Array of trend insights for each category
     *
     * Only considers: shopping_merc, food_orders, bills, transfers, other
     * Excludes: salary, savings
     */
    async getCategoryTrends(statementIds, getCategoriesByStatementId) {
        if (!Array.isArray(statementIds) || statementIds.length !== 3) {
            throw new Error('Exactly 3 statement IDs required');
        }

        // Categories to analyze
        const categories = ['shopping_merc', 'food_orders', 'bills', 'transfers', 'other'];
        // Fetch category totals for each statement
        const [cat1, cat2, cat3] = await Promise.all(statementIds.map(id => getCategoriesByStatementId(id)));

        const results = [];
        for (const cat of categories) {
            // Get values for this category in each statement (default 0 if missing)
            const v1 = cat1[cat] || 0;
            const v2 = cat2[cat] || 0;
            const v3 = cat3[cat] || 0;
            // Calculate trend: increase/decrease/flat
            let trend = 'no significant change';
            let percent = 0;
            let insight = '';
            // Calculate average percentage change between months
            // Avoid division by zero
            const pct1 = v1 === 0 ? (v2 === 0 ? 0 : 100) : ((v2 - v1) / Math.abs(v1)) * 100;
            const pct2 = v2 === 0 ? (v3 === 0 ? 0 : 100) : ((v3 - v2) / Math.abs(v2)) * 100;
            percent = ((pct1 + pct2) / 2).toFixed(2);
            if (v1 < v2 && v2 < v3) {
                trend = 'increase';
                insight = `There was an increase in spending on ${cat.replace('_', ' ')} over the last 3 months with an average increase of ${percent}%`;
            } else if (v1 > v2 && v2 > v3) {
                trend = 'decrease';
                insight = `There was a decrease in spending on ${cat.replace('_', ' ')} over the last 3 months with an average decrease of ${Math.abs(percent)}%`;
            } else if (v1 === v2 && v2 === v3) {
                trend = 'flat';
                insight = `Spending on ${cat.replace('_', ' ')} remained constant over the last 3 months.`;
            } else {
                // Mixed trend
                if (percent > 0) {
                    trend = 'increase';
                    insight = `Spending on ${cat.replace('_', ' ')} fluctuated but overall increased by an average of ${percent}% over the last 3 months.`;
                } else if (percent < 0) {
                    trend = 'decrease';
                    insight = `Spending on ${cat.replace('_', ' ')} fluctuated but overall decreased by an average of ${Math.abs(percent)}% over the last 3 months.`;
                } else {
                    insight = `Spending on ${cat.replace('_', ' ')} showed no significant change over the last 3 months.`;
                }
            }
            results.push({
                category: cat,
                values: [v1, v2, v3],
                trend,
                percent: Number(percent),
                insight
            });
        }
        return results;
    }
}

module.exports = TransactionParser;
