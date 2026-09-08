const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block local temporary agent directories from Metro file watching
config.resolver = {
  ...config.resolver,
  blockList: [
    new RegExp(path.join(__dirname, ".local").replace(/\\/g, "/") + ".*"),
    new RegExp(path.join(__dirname, ".agents").replace(/\\/g, "/") + ".*"),
  ],
};

module.exports = config;
