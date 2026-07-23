const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
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

class CopyAppCssPlugin {
  apply(compiler) {
    compiler.plugin('emit', (compilation, callback) => {
      const css = fs.readFileSync(path.resolve(__dirname, 'src/app.css'));
      compilation.assets['app.css'] = {
        source: () => css,
        size: () => css.length,
      };
      callback();
    });
  }
}

module.exports = {
  entry: {
    app: './src/word-art.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devServer: {
    contentBase: './dist'
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      'window.$': 'jquery'
    }),
    new CleanWebpackPlugin(['dist']),
    new CopyAppCssPlugin(),
    new HtmlWebpackPlugin({
      title: 'Word Art Generator',
      template: './src/index.html',
      inject: false,
      assetVersion: getAssetVersion(),
    }),
    new UglifyJSPlugin()
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
