const webpack = require('webpack');
const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/front/index.js', // ✅ Ruta corregida
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'build'),
    publicPath: '/',
  },
  mode: 'production',
  module: {
    rules: [
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
      allowEmptyValues: true
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
  devtool: 'source-map',
};
