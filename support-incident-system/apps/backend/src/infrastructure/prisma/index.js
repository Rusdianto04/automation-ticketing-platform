"use strict";

/**
 * src/infrastructure/prisma/index.js
 * Single source of truth for Prisma client — backend only.
 */

module.exports = {
  prisma:     require("./client"),
  setupViews: require("./views").setupViews,
};
