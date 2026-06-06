# PDF Table Parsing - Bank Statement Parser Fix

## Problem
The basic `pdf-parse` library extracts text linearly without preserving the spatial/tabular structure of PDF tables. This causes:
- Columns to get misaligned or merged
- Difficulty identifying which text belongs to which column
- Inconsistent parsing across different PDF formats

## Solution Implemented

### Using PDF.js (pdfjs-dist)
We've enhanced the parser to use **Mozilla's PDF.js** which provides:
- **X,Y coordinates** for each text item
- **Preserved table structure** by grouping text items by row (Y coordinate)
- **Column alignment** by sorting text items within rows by X coordinate
- **Fallback to pdf-parse** if PDF.js fails

### How It Works

1. **parsePDFWithStructure()**: Extracts text with coordinate information
   - Reads each page of the PDF
   - Gets text content with position data
   - Groups text items by Y coordinate (rows)
   - Sorts items within each row by X coordinate (columns)
   - Joins items to form structured lines

2. **extractTransactionsFromStructuredText()**: Processes structured text
   - Uses the same transaction patterns
   - Better column separation leads to more accurate parsing

## Alternative Solutions

### Option 1: Use Tabula-js (Recommended for complex tables)
```bash
npm install tabula-js
```

```javascript
const tabula = require('tabula-js');

async parsePDFWithTabula(pdfPath) {
    const options = {
        pages: 'all',
        guess: true,  // Auto-detect tables
        silent: true
    };
    
    const tables = await tabula(pdfPath, options);
    return this.parseTableData(tables);
}
```

### Option 2: Use pdf2json (More control)
```bash
npm install pdf2json
```

```javascript
const PDFParser = require('pdf2json');

async parsePDFWithPDF2JSON(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
            const rows = this.extractRowsFromPDF2JSON(pdfData);
            resolve(rows);
        });
        
        pdfParser.on('pdfParser_dataError', reject);
        pdfParser.loadPDF(pdfPath);
    });
}
```

### Option 3: Use Python's Camelot (Best for complex tables)
If you need the most robust solution, use Python's Camelot via child_process:

```bash
pip install camelot-py[cv]
```

Create a Python script:
```python
# extract_tables.py
import camelot
import json
import sys

tables = camelot.read_pdf(sys.argv[1], pages='all', flavor='stream')
data = [table.df.to_dict('records') for table in tables]
print(json.dumps(data))
```

Call from Node.js:
```javascript
const { execSync } = require('child_process');

parsePDFWithCamelot(pdfPath) {
    const output = execSync(`python extract_tables.py "${pdfPath}"`);
    return JSON.parse(output.toString());
}
```

## Improving Transaction Pattern Matching

If you still have issues, enhance the regex patterns in transactionParser.js:

```javascript
// More flexible patterns
this.transactionPattern = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([\-\+]?\d{1,3}(?:,?\d{3})*\.?\d{0,2})$/;

// Handle multiple spaces/tabs between columns
this.transactionPatternWithBalance = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.+?)\s+([\d,\.]+)?\s+([\d,\.]+)?\s+([\d,\.]+)$/;
```

## Common Issues and Fixes

### 3. Multi-line descriptions
**Fix**: Implement row merging logic:
```javascript
// If next line doesn't start with date, append to previous transaction
if (!lineStartsWithDate && previousTransaction) {
    previousTransaction.description += ' ' + line;
}
```

### 4. Different bank formats
**Fix**: Add bank-specific parsers:
```javascript
const bankPatterns = {
    HDFC: /specific pattern/,
    SBI: /another pattern/,
    ICICI: /yet another/
};
```

## Performance Considerations

- PDF.js is slightly slower but more accurate
- For large PDFs, consider processing pages in parallel
- Cache parsed results if processing the same PDF multiple times

## Next Steps

1. Test with your actual bank statement PDFs
2. Adjust patterns based on your bank's format
3. Consider implementing bank-specific parsers
4. Add validation to ensure extracted data is correct
