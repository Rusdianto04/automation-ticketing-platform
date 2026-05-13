"use strict";

/**
 * src/common/logger/index.js
 * Lightweight structured logger (no external deps, mirrors console API).
 * Format: [LEVEL] [MODULE] message { meta }
 */

const config = require("../../config");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = config.isDev ? LEVELS.debug : LEVELS.info;

function fmt(level, module, message, meta) {
  const ts  = new Date().toISOString();
  const pfx = `[${ts}] [${level.toUpperCase()}] [${module}]`;
  if (meta && Object.keys(meta).length > 0) {
    return `${pfx} ${message} ${JSON.stringify(meta)}`;
  }
  return `${pfx} ${message}`;
}

function createLogger(module = "APP") {
  return {
    error: (msg, meta = {}) => {
      if (LEVELS.error <= currentLevel) console.error(fmt("error", module, msg, meta));
    },
    warn:  (msg, meta = {}) => {
      if (LEVELS.warn  <= currentLevel) console.warn(fmt("warn",  module, msg, meta));
    },
    info:  (msg, meta = {}) => {
      if (LEVELS.info  <= currentLevel) console.log(fmt("info",  module, msg, meta));
    },
    debug: (msg, meta = {}) => {
      if (LEVELS.debug <= currentLevel) console.log(fmt("debug", module, msg, meta));
    },
  };
}

module.exports = { createLogger };
