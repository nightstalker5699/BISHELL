const axios = require("axios");
const AppError = require("./appError");
const catchAsync = require("./catchAsync");
const mongoose = require("mongoose");

const API_KEY = "AIzaSyDbW33CM_oTWhIOzTsJDRf4A39roukix0Q";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const BOT_ID = new mongoose.Types.ObjectId("67ef9dc8024d1e4ae6326f4f");

const SYSTEM_PROMPT = `Act as a study mate for the students using you, your name is Elda7e7, you should act like a nerdy study mate. Try to answer their questions with details and examples if needed, and answer in Egyptian Arabic if they don't specify a preferred language. You're working for BIShell site. Your answers should be concise, helpful, and appropriate for educational purposes.`;

/**
 * Get the AI bot user ID
 * @returns {mongoose.Types.ObjectId} The bot account's ObjectId
 */
const getBotUserId = () => {
  return BOT_ID;
};

/**
 * Extract the actual prompt from a comment containing an AI command
 * @param {string} commentContent - The content of the comment with the /ai command
 * @returns {string} The extracted prompt or empty string if not found
 */
const extractPromptFromCommand = (commentContent) => {
  if (commentContent.toLowerCase().includes("/ai")) {
    return commentContent.replace(/\/ai/i, "").trim();
  }

  return ""; // No /ai command found
};

/**
 * Formats content for sending to Gemini API
 * @param {string} questionContent - The question content for context
 * @param {string} promptContent - The prompt content extracted from the comment
 * @returns {Array} Formatted messages for the Gemini API
 */
const formatContentForGemini = (questionContent, promptContent) => {
  let userPrompt;

  if (promptContent) {
    userPrompt = `${promptContent}\n\nContext (question being discussed): "${questionContent}"`;
  } else {
    userPrompt = `Please explain this concept/question clearly: "${questionContent}"`;
  }

  return [
    {
      role: "user",
      parts: [{ text: SYSTEM_PROMPT }],
    },
    {
      role: "model",
      parts: [
        {
          text: "I understand. I am Elda7e7, a nerdy study mate for BISHell site users. I will provide detailed answers with examples when needed and respond in Egyptian Arabic unless another language is requested.",
        },
      ],
    },
    {
      role: "user",
      parts: [{ text: userPrompt }],
    },
  ];
};

/**
 * Calls the Gemini API to get an explanation for a question
 * @param {string} questionContent - The content of the question for context
 * @param {string} commentContent - The content of the comment with the AI command
 * @returns {Promise<string>} The AI explanation
 */
const getAIExplanation = async (questionContent, commentContent) => {
  try {
    const promptContent = extractPromptFromCommand(commentContent);

    const response = await axios({
      method: "POST",
      url: `${API_URL}?key=${API_KEY}`,
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        contents: formatContentForGemini(questionContent, promptContent),
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      },
    });

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new AppError("No response received from AI", 500);
    }

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(
      "Error calling Gemini API:",
      error.response?.data || error.message
    );
    throw new AppError("Failed to get AI explanation", 500);
  }
};
module.exports = {
  getAIExplanation,
  getBotUserId,
};
