const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const collectFiles = (directory) => fs.readdirSync(directory).reduce((files, entry) => {
  const entryPath = path.join(directory, entry);
  return files.concat(fs.statSync(entryPath).isDirectory() ? collectFiles(entryPath) : entryPath);
}, []);

const getAssetVersion = () => {
  const hash = crypto.createHash('sha256');
  const inputs = collectFiles(path.resolve(__dirname, 'src')).concat([
    path.resolve(__dirname, 'package-lock.json'),
    __filename,
  ]);

  inputs.sort().forEach(file => {
    hash.update(path.relative(__dirname, file));
    hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  });

  return hash.digest('hex').slice(0, 12);
};

module.exports = {
  mode: 'production',
  entry: {
    app: './src/word-art.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: ['jquery', 'default'],
      jQuery: ['jquery', 'default'],
      'window.jQuery': ['jquery', 'default'],
      'window.$': ['jquery', 'default']
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/app.css'),
          to: 'app.css',
        },
      ],
    }),
    new HtmlWebpackPlugin({
      title: 'Word Art Generator',
      template: './src/index.html',
      inject: false,
      assetVersion: getAssetVersion(),
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
};
