"use strict";
/**
 * src/modules/chatbot/index.js
 * Public API of the chatbot module.
 */
module.exports = {
  chatbotRouter:     require("./routes/chatbot.route"),
  knowledgeRouter:   require("./routes/knowledge.route"),
  ChatbotService:    require("./services/chatbot.service"),
  KnowledgeService:  require("./services/knowledge.service"),
  ChatbotRepository: require("./repositories/chatbot.repository"),
};
