"use strict";
/**
 * src/modules/ticket/index.js
 * Public API of the ticket module.
 */
module.exports = {
  router:                   require("./routes/ticket.route"),
  recommendRouter:          require("./routes/recommendation.route"),
  TicketService:            require("./services/ticket.service"),
  RecommendationService:    require("./services/recommendation.service"),
  ClassifierService:        require("./services/classifier.service"),
  TicketRepository:         require("./repositories/ticket.repository"),
  RecommendationRepository: require("./repositories/recommendation.repository"),
  TicketMapper:             require("./mappers/ticket.mapper"),
  dto:                      require("./dto/ticket.dto"),
};
