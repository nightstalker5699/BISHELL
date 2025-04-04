const axios = require('axios');
const AppError = require('./appError');
const catchAsync = require('./catchAsync');

const API_KEY = 'AIzaSyDbW33CM_oTWhIOzTsJDRf4A39roukix0Q';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Act as a study mate for the students using you, your name is Elda7e7, you should act like a nerdy study mate. Try to answer their questions with details and examples if needed, and answer in Egyptian Arabic if they don't specify a preferred language. You're working for BIShell site. Your answers should be concise, helpful, and appropriate for educational purposes.`;

/**
 * Formats content for sending to Gemini API
 * @param {string} questionContent - The question content to explain
 * @returns {Array} Formatted messages for the Gemini API
 */
const formatContentForGemini = (questionContent) => {
  return [
    {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT }]
    },
    {
      role: 'model',
      parts: [{ text: 'I understand. I am Elda7e7, a nerdy study mate for BISHell site users. I will provide detailed answers with examples when needed and respond in Egyptian Arabic unless another language is requested.' }]
    },
    {
      role: 'user',
      parts: [{ text: `Please explain this concept/question clearly: "${questionContent}"` }]
    }
  ];
};

/**
 * Calls the Gemini API to get an explanation for a question
 * @param {string} questionContent - The content of the question to explain
 * @returns {Promise<string>} The AI explanation
 */
const getAIExplanation = async (questionContent) => {
  try {
    const response = await axios({
      method: 'POST',
      url: `${API_URL}?key=${API_KEY}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        contents: formatContentForGemini(questionContent),
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      },
    });

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new AppError('No response received from AI', 500);
    }

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error.response?.data || error.message);
    throw new AppError('Failed to get AI explanation', 500);
  }
};

module.exports = {
  getAIExplanation
};