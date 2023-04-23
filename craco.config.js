const config = {
  configure: (webpackConfig) => {
    webpackConfig.resolve.fallback.assert = require.resolve("assert");
    webpackConfig.resolve.fallback.buffer = require.resolve("buffer");
  },
};

module.exports = config;
