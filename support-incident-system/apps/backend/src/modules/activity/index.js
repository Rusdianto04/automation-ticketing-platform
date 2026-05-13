"use strict";
/**
 * src/modules/activity/index.js
 * Public API of the activity module.
 */
module.exports = {
  ActivityRepository: require("./repositories/activity.repository"),
  ActivityService:    require("./services/activity.service"),
};
