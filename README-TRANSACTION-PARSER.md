# Transaction Parser - Extracting Clean Transaction Data from PDFs

## Overview
The Transaction Parser extracts only transaction details from bank statement PDFs, filtering out:
- Bank details (name, address, IFSC, etc.)
- Customer information
- Headers and footers
- Legal disclaimers
- Page numbers

## Features

✅ **Smart Pattern Matching** - Automatically detects transaction patterns  
✅ **Multiple Format Support** - Handles different bank statement formats  
✅ **Date Range Filtering** - Filter transactions by date  
✅ **Amount Filtering** - Filter by transaction amount  
✅ **Auto Categorization** - Categorize transactions (ATM, Shopping, Bills, etc.)  
✅ **Debit/Credit Separation** - Automatically identifies transaction types

## Usage

### Basic Parsing

```javascript
const TransactionParser = require('./services/transactionParser');

const parser = new TransactionParser();
const result = await parser.parsePDF('./statement.pdf');

// Output:
// [
//   {
//     date: 2025-01-15T00:00:00.000Z,
//     description: 'ATM Withdrawal',
//     amount: -500,
//     type: 'debit',
//     rawLine: '15/01/2025    ATM Withdrawal    -500.00'
//   },
//   ...
// ]
```

### Custom Parsing Rules

```javascript
const result = await parser.parseWithCustomRules('./statement.pdf', {
    excludeKeywords: ['promotional', 'disclaimer'],
    dateFormat: 'DD/MM/YYYY'
});
```

### Filter Transactions

```javascript
// By date range
const filtered = parser.filterByDateRange(
    transactions,
    new Date('2025-01-01'),
    new Date('2025-01-31')
);

// By amount
const large = parser.filterByAmountRange(transactions, 1000, 10000);
```

### Categorize Transactions

```javascript
const categories = parser.categorizeTransactions(transactions);
// {
//   atm: [...],
//   shopping: [...],
//   bills: [...],
//   transfers: [...],
//   salary: [...],
//   other: [...]
// }
```

## How It Works

### 1. Text Extraction
Uses `pdf-parse` to extract raw text from PDF

### 2. Pattern Matching
Identifies transaction lines using regex patterns:
- Date patterns: `DD/MM/YYYY`, `DD-MM-YYYY`
- Amount patterns: `123.45`, `-500.00`, `+1000`

### 3. Filtering
Excludes non-transaction lines:
- Bank information
- Account details
- Headers/footers
- Empty lines

### 4. Structuring
Converts matched lines into structured objects with:
- Date (Date object)
- Description (string)
- Amount (number)
- Type (debit/credit)

## Supported Formats

The parser handles multiple bank statement formats:

**Format 1: Simple**
```
Date          Description           Amount
15/01/2025    ATM Withdrawal       -500.00
16/01/2025    Salary Credit        +5000.00
```

**Format 2: With Balance**
```
Date          Description    Debit    Credit   Balance
15/01/2025    Shopping       500.00            4500.00
16/01/2025    Transfer                1000.00  5500.00
```

## Customization

### Add Custom Exclude Patterns

```javascript
parser.excludePatterns.push(/your-custom-pattern/i);
```

### Modify Transaction Patterns

```javascript
parser.transactionPattern = /your-custom-regex/;
```

## Integration with Database

```javascript
const { Statement, Transaction } = require('./models');

async function saveTransactions(pdfPath, userId, date) {
    const parser = new TransactionParser();
    const result = await parser.parsePDF(pdfPath);
    
    if (result.success) {
        // Create statement
        const stmt_id = `${userId}_${date}`;
        await Statement.create(stmt_id, userId, 'pending');
        
        // Save transactions
        for (const txn of result.transactions) {
            await Transaction.create(
                stmt_id,
                txn.description,
                txn.amount,
                txn.date
            );
        }
        
        // Update statement status
        await Statement.updateStatus(stmt_id, 'completed');
    }
}
```

## Tips for Better Accuracy

1. **Test with Your Bank Format**: Each bank has slightly different formats
2. **Adjust Patterns**: Modify regex patterns for your specific format
3. **Add Custom Keywords**: Add bank-specific terms to exclude patterns
4. **Verify Results**: Always validate parsed data before saving to database
5. **Handle Edge Cases**: Some transactions may span multiple lines

## Example Output

```json
{
  "success": true,
  "transactions": [
    {
      "date": "2025-01-15T00:00:00.000Z",
      "description": "ATM WDL LOCATION XYZ",
      "amount": -500,
      "type": "debit",
      "rawLine": "15/01/2025    ATM WDL LOCATION XYZ    -500.00"
    },
    {
      "date": "2025-01-16T00:00:00.000Z",
      "description": "SALARY CREDIT",
      "amount": 50000,
      "type": "credit",
      "rawLine": "16/01/2025    SALARY CREDIT    +50000.00"
    }
  ],
  "totalCount": 2,
  "metadata": {
    "pages": 3,
    "extractedLines": 150
  }
}
```
