const webpack = require('webpack');
const path = require('path');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/front/js/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/', // 👉 necesario para rutas internas en React
  },
  mode: 'production',
  resolve: {
    extensions: ['.js', '.jsx'], // 👉 para que reconozca .jsx
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // 👉 importante para JSX
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
          test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif|jpeg|webp)$/,
        use: {
          loader: 'file-loader',
          options: { name: '[name].[ext]' }
        }
      },
      { test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/, use: ['file-loader'] }
    ],
  },
  plugins: [
    new Dotenv({
      path: './.env',
      systemvars: true,
      allowEmptyValues: true,
    }),
    new webpack.DefinePlugin({
      'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL || ''),
    }),
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      filename: 'index.html',
    }),
  ],
  devtool: 'source-map',
};
