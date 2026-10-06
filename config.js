// KONFIGURASI PROVIDER — GEMINI
const { buildSystemPrompt, CATEGORIES, postProcess } = require('./prompts/builder');

module.exports = {
    active: 'gemini',
    gemini: {
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        apiKeyEnv: 'GEMINI_API_KEY',
        model: 'gemini-2.5-flash'
    },
    buildSystemPrompt,
    postProcess,
    CATEGORIES
};
