/**
 * LLM Insights Service – Live API Integration Check
 *
 * This is NOT a Jest test. Run it directly to verify the OpenAI API
 * key is valid and the LLM returns a well-formed response.
 *
 * Usage:
 *   node tests/llmInsightsService.integration.js
 */

const LLMInsightsService = require('../services/llmInsightsService');

const sampleData = [
    {
        label: 'January 2025',
        shopping_merc: 8500.00,
        food_orders: 3200.50,
        bills: 4100.00,
        transfers: 1500.00,
        other: 900.00,
        salary: 65000.00,
        savings: 10000.00
    },
    {
        label: 'February 2025',
        shopping_merc: 9800.75,
        food_orders: 4500.00,
        bills: 4100.00,
        transfers: 2000.00,
        other: 1200.00,
        salary: 65000.00,
        savings: 8000.00
    },
    {
        label: 'March 2025',
        shopping_merc: 12300.00,
        food_orders: 5100.25,
        bills: 4200.00,
        transfers: 2500.00,
        other: 1800.00,
        salary: 65000.00,
        savings: 6000.00
    }
];

(async () => {
    console.log('=== LLM Insights Service – Live API Check ===\n');
    console.log('Sending 3 months of spending data to OpenAI...\n');

    const service = new LLMInsightsService();

    try {
        const result = await service.analyzeSpending(sampleData);

        console.log('✔  API key is valid. Response received.\n');

        console.log('─── Insights ───────────────────────────────────────────');
        console.log(result.insights);

        console.log('\n─── Category Highlights ────────────────────────────────');
        if (result.category_highlights?.length) {
            result.category_highlights.forEach(h =>
                console.log(`  [${h.category}]  ${h.observation}`)
            );
        } else {
            console.log('  (none returned)');
        }

        console.log('\n─── Savings Summary ────────────────────────────────────');
        console.log(result.savings_summary);

        console.log('\n─── Suggestions ────────────────────────────────────────');
        if (result.suggestions?.length) {
            result.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
        } else {
            console.log('  (none returned)');
        }

        console.log('\n─── Raw JSON from model ────────────────────────────────');
        try {
            console.log(JSON.stringify(JSON.parse(result.raw), null, 2));
        } catch {
            console.log(result.raw);
        }

    } catch (err) {
        console.error('✘  API call failed.\n');
        console.error('Error:', err.message);
        if (err.status) console.error('HTTP status:', err.status);
        if (err.code)   console.error('Error code: ', err.code);
        process.exit(1);
    }
})();
