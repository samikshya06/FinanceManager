const LLMInsightsService = require('../services/llmInsightsService');

// Mock the OpenAI client so no real API calls are made
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }));
});

const OpenAI = require('openai');

// ─── Shared test data ────────────────────────────────────────────────────────

const THREE_MONTHS_FULL = [
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

const THREE_MONTHS_NO_OPTIONAL = [
    {
        label: 'January 2025',
        shopping_merc: 5000.00,
        food_orders: 2000.00,
        bills: 3000.00,
        transfers: 1000.00,
        other: 500.00
        // no salary, no savings
    },
    {
        label: 'February 2025',
        shopping_merc: 5500.00,
        food_orders: 2100.00,
        bills: 3000.00,
        transfers: 1100.00,
        other: 600.00
    },
    {
        label: 'March 2025',
        shopping_merc: 4800.00,
        food_orders: 1900.00,
        bills: 2900.00,
        transfers: 900.00,
        other: 450.00
    }
];

const THREE_MONTHS_MISSING_FIELDS = [
    { label: 'January 2025' },   // all spend fields undefined / null
    { label: 'February 2025' },
    { label: 'March 2025' }
];

const MOCK_LLM_RESPONSE = {
    insights: 'Shopping and food spending have been rising steadily over the 3-month period.',
    category_highlights: [
        { category: 'Shopping/Merchandise', observation: 'Increased by ₹3800 (44.7%) over 3 months' },
        { category: 'Food Orders', observation: 'Rose from ₹3200 to ₹5100 — a 59% increase' }
    ],
    savings_summary: 'Current savings are declining. With discipline, ₹12000/month is achievable.',
    suggestions: [
        'Cap online shopping to ₹8000/month by using a budget tracker.',
        'Reduce food delivery orders to 3 times per week.',
        'Automate a SIP of ₹5000 at the start of each month.',
        'Review recurring subscriptions included in "Bills" to cut unused ones.',
        'Set a ₹1500 limit on discretionary "Other" expenses.'
    ]
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function mockOpenAIResponse(service, responsePayload) {
    service.client.chat.completions.create.mockResolvedValueOnce({
        choices: [
            { message: { content: JSON.stringify(responsePayload) } }
        ]
    });
}

function mockOpenAIRawResponse(service, rawString) {
    service.client.chat.completions.create.mockResolvedValueOnce({
        choices: [
            { message: { content: rawString } }
        ]
    });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LLMInsightsService', () => {
    let service;

    beforeEach(() => {
        service = new LLMInsightsService();
    });

    // ── Input validation ─────────────────────────────────────────────────────

    describe('analyzeSpending – input validation', () => {
        test('throws when called with fewer than 3 months', async () => {
            await expect(service.analyzeSpending([THREE_MONTHS_FULL[0]])).rejects.toThrow(
                'analyzeSpending requires exactly 3 months of data'
            );
        });

        test('throws when called with more than 3 months', async () => {
            const fourMonths = [...THREE_MONTHS_FULL, THREE_MONTHS_FULL[0]];
            await expect(service.analyzeSpending(fourMonths)).rejects.toThrow(
                'analyzeSpending requires exactly 3 months of data'
            );
        });

        test('throws when called with an empty array', async () => {
            await expect(service.analyzeSpending([])).rejects.toThrow(
                'analyzeSpending requires exactly 3 months of data'
            );
        });

        test('throws when called with null', async () => {
            await expect(service.analyzeSpending(null)).rejects.toThrow(
                'analyzeSpending requires exactly 3 months of data'
            );
        });

        test('throws when called with a non-array value', async () => {
            await expect(service.analyzeSpending('bad input')).rejects.toThrow(
                'analyzeSpending requires exactly 3 months of data'
            );
        });
    });

    // ── Happy path ───────────────────────────────────────────────────────────

    describe('analyzeSpending – happy path', () => {
        test('returns parsed insights when LLM responds with valid JSON', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);

            const result = await service.analyzeSpending(THREE_MONTHS_FULL);

            expect(result.insights).toBe(MOCK_LLM_RESPONSE.insights);
            expect(result.savings_summary).toBe(MOCK_LLM_RESPONSE.savings_summary);
            expect(result.suggestions).toEqual(MOCK_LLM_RESPONSE.suggestions);
            expect(result.category_highlights).toEqual(MOCK_LLM_RESPONSE.category_highlights);
            expect(result.raw).toBe(JSON.stringify(MOCK_LLM_RESPONSE));
        });

        test('result contains a non-empty raw string', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            const result = await service.analyzeSpending(THREE_MONTHS_FULL);
            expect(typeof result.raw).toBe('string');
            expect(result.raw.length).toBeGreaterThan(0);
        });

        test('works with monthly data that omits optional salary and savings fields', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            const result = await service.analyzeSpending(THREE_MONTHS_NO_OPTIONAL);
            expect(result.insights).toBeTruthy();
        });

        test('works when spend fields are undefined (defaults to 0.00)', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            // Should not throw — _buildPrompt uses ?. with fallback '0.00'
            const result = await service.analyzeSpending(THREE_MONTHS_MISSING_FIELDS);
            expect(result.insights).toBeTruthy();
        });

        test('calls the OpenAI API exactly once per analyzeSpending call', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);
            expect(service.client.chat.completions.create).toHaveBeenCalledTimes(1);
        });

        test('passes both system and user messages to the API', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const roles = callArgs.messages.map(m => m.role);
            expect(roles).toContain('system');
            expect(roles).toContain('user');
        });

        test('user prompt contains all 3 month labels', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).toContain('January 2025');
            expect(userMessage).toContain('February 2025');
            expect(userMessage).toContain('March 2025');
        });

        test('user prompt contains spend figures formatted with ₹ symbol', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).toContain('₹');
            expect(userMessage).toContain('8500.00');  // January shopping_merc
            expect(userMessage).toContain('5100.25');  // March food_orders
        });

        test('requests json_object response format', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            expect(callArgs.response_format).toEqual({ type: 'json_object' });
        });
    });

    // ── Invalid / partial LLM responses ──────────────────────────────────────

    describe('analyzeSpending – malformed LLM response', () => {
        test('returns raw string in insights when LLM returns invalid JSON', async () => {
            mockOpenAIRawResponse(service, 'This is not JSON at all.');

            const result = await service.analyzeSpending(THREE_MONTHS_FULL);

            expect(result.insights).toBe('This is not JSON at all.');
            expect(result.suggestions).toBe('');
            expect(result.category_highlights).toEqual([]);
            expect(result.savings_summary).toBe('');
            expect(result.raw).toBe('This is not JSON at all.');
        });

        test('fills missing fields with defaults when JSON lacks expected keys', async () => {
            mockOpenAIRawResponse(service, JSON.stringify({ insights: 'Only this key exists.' }));

            const result = await service.analyzeSpending(THREE_MONTHS_FULL);

            expect(result.insights).toBe('Only this key exists.');
            expect(result.suggestions).toEqual([]);
            expect(result.category_highlights).toEqual([]);
            expect(result.savings_summary).toBe('');
        });

        test('handles empty JSON object from LLM gracefully', async () => {
            mockOpenAIRawResponse(service, '{}');

            const result = await service.analyzeSpending(THREE_MONTHS_FULL);

            expect(result.insights).toBe('');
            expect(result.suggestions).toEqual([]);
            expect(result.category_highlights).toEqual([]);
            expect(result.savings_summary).toBe('');
        });
    });

    // ── OpenAI API errors ─────────────────────────────────────────────────────

    describe('analyzeSpending – API errors', () => {
        test('propagates error when the OpenAI API call fails', async () => {
            service.client.chat.completions.create.mockRejectedValueOnce(
                new Error('OpenAI API rate limit exceeded')
            );

            await expect(service.analyzeSpending(THREE_MONTHS_FULL)).rejects.toThrow(
                'OpenAI API rate limit exceeded'
            );
        });

        test('propagates network timeout errors', async () => {
            service.client.chat.completions.create.mockRejectedValueOnce(
                new Error('Request timeout')
            );

            await expect(service.analyzeSpending(THREE_MONTHS_FULL)).rejects.toThrow(
                'Request timeout'
            );
        });
    });

    // ── _buildPrompt (internal, tested indirectly) ────────────────────────────

    describe('_buildPrompt – prompt structure', () => {
        test('includes salary line when salary is provided', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).toContain('Salary / Income');
            expect(userMessage).toContain('65000.00');
        });

        test('includes savings line when savings is provided', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_FULL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).toContain('Investments/Savings');
        });

        test('omits salary line when salary is not provided', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_NO_OPTIONAL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).not.toContain('Salary / Income');
        });

        test('omits savings line when savings is not provided', async () => {
            mockOpenAIResponse(service, MOCK_LLM_RESPONSE);
            await service.analyzeSpending(THREE_MONTHS_NO_OPTIONAL);

            const callArgs = service.client.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user').content;

            expect(userMessage).not.toContain('Investments/Savings');
        });
    });
});
