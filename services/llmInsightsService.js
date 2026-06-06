require('dotenv').config();
const OpenAI = require('openai');
const openAIAPI_KEy = 'Your_OPEN_AIP_API_KEY';
/**
 * LLM Insights Service
 * Uses an OpenAI model to analyze 3 months of categorized spending
 * and return actionable insights and savings suggestions.
 *
 * Expected input shape per month:
 * {
 *   label: string,          // e.g. "January 2025"
 *   shopping_merc: number,
 *   food_orders:   number,
 *   bills:         number,
 *   transfers:     number,
 *   other:         number,
 *   salary:        number,  // optional – used for context
 *   savings:       number   // optional – used for context
 * }
 */

class LLMInsightsService {
    constructor() {
        // if (!process.env.OPENAI_API_KEY) {
        //     throw new Error('OPENAI_API_KEY is not set in environment variables');
        // }
        // this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.client = new OpenAI({ apiKey: openAIAPI_KEy });
        this.model = 'gpt-4o-mini';
    }

    /**
     * Build the user prompt from 3 months of category data
     * @param {Array<Object>} monthlyData - Array of exactly 3 month objects
     * @returns {string}
     */
    _buildPrompt(monthlyData) {
        const lines = monthlyData.map(month => {
            const spending = [
                `  Shopping/Merchandise : ₹${month.shopping_merc?.toFixed(2) ?? '0.00'}`,
                `  Food Orders          : ₹${month.food_orders?.toFixed(2) ?? '0.00'}`,
                `  Bills & Utilities    : ₹${month.bills?.toFixed(2) ?? '0.00'}`,
                `  Transfers (debits)   : ₹${month.transfers?.toFixed(2) ?? '0.00'}`,
                `  Other Expenses       : ₹${month.other?.toFixed(2) ?? '0.00'}`,
            ];
            if (month.salary != null) spending.unshift(`  Salary / Income      : ₹${month.salary.toFixed(2)}`);
            if (month.savings != null) spending.push(`  Investments/Savings  : ₹${month.savings.toFixed(2)}`);

            return `### ${month.label}\n${spending.join('\n')}`;
        });

        return `Below is a user's categorized spending data for 3 consecutive months:\n\n${lines.join('\n\n')}`;
    }

    /**
     * Analyze 3 months of spending with the LLM and return insights
     * @param {Array<Object>} monthlyData - Array of exactly 3 month objects
     * @returns {Promise<{ insights: string, suggestions: string, raw: string }>}
     */
    async analyzeSpending(monthlyData) {
        if (!Array.isArray(monthlyData) || monthlyData.length !== 3) {
            throw new Error('analyzeSpending requires exactly 3 months of data');
        }

        const systemPrompt = `You are a personal finance advisor. The user will share 3 months of their categorized spending data. 
Your task is to:
1. Identify spending trends per category (increasing, decreasing, or stable).
2. Highlight any categories with worrying growth or unusually high spend.
3. Provide a concise savings summary — how much they could realistically save each month.
4. Give 3–5 concrete, actionable suggestions to improve their financial health.

Respond in the following JSON format (no extra text outside the JSON):
{
  "insights": "<paragraph summarizing trends and notable observations>",
  "category_highlights": [
    { "category": "<name>", "observation": "<short observation>" }
  ],
  "savings_summary": "<paragraph with estimated savings potential and reasoning>",
  "suggestions": [
    "<suggestion 1>",
    "<suggestion 2>",
    "<suggestion 3>"
  ]
}`;

        const userPrompt = this._buildPrompt(monthlyData);

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.4,
            response_format: { type: 'json_object' }
        });

        const raw = response.choices[0].message.content;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Return raw string if the model did not produce valid JSON
            return { insights: raw, suggestions: '', category_highlights: [], savings_summary: '', raw };
        }

        return {
            insights: parsed.insights || '',
            category_highlights: parsed.category_highlights || [],
            savings_summary: parsed.savings_summary || '',
            suggestions: parsed.suggestions || [],
            raw
        };
    }
}

module.exports = LLMInsightsService;
