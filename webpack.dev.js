const webpack = require('webpack');
const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

const port = 3000;
let publicUrl = `ws://localhost:${port}/ws`;

// Para Gitpod
if (process.env.GITPOD_WORKSPACE_URL) {
  const [schema, host] = process.env.GITPOD_WORKSPACE_URL.split('://');
  publicUrl = `wss://${port}-${host}/ws`;
}

// Para Codespaces
if (process.env.CODESPACE_NAME) {
  publicUrl = `wss://${process.env.CODESPACE_NAME}-${port}.app.github.dev/ws`;
}

module.exports = merge(common, {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  resolve: {
    extensions: ['.js', '.jsx'], // 👉 para que reconozca .jsx
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // 👉 también acepta JSX
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ],
  },
  devServer: {
    port,
    hot: true,
    allowedHosts: 'all',
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, 'dist'),
    },
    client: {
      webSocketURL: publicUrl,
    },
  },
  plugins: [new webpack.HotModuleReplacementPlugin()],
});
