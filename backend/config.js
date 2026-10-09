// KONFIGURASI PROVIDER — DEEPSEEK (API key admin via .env)
const { buildSystemPrompt, CATEGORIES, postProcess } = require('./prompts/builder');

module.exports = {
    active: 'deepseek',
    deepseek: {
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com',
        // deepseek-chat (V3) atau deepseek-reasoner
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    },
    buildSystemPrompt,
    postProcess,
    CATEGORIES
};
