const webpack = require("webpack");

module.exports = function override(config) {
  // fallback tanımlaması (webpack 5 için)
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    process: require.resolve("process/browser"),
  };

  // ProvidePlugin ile global process tanımlaması
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ]);

  return config;
};
