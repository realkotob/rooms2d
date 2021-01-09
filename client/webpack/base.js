const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  cache: {
    type: 'filesystem'
  },
  devtool: "eval-source-map",
  output: {
    path: path.resolve(__dirname, "../../public/"),
    filename: "bundle.min.js",
    publicPath: '/public/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: [/\.vert$/, /\.frag$/],
        use: "raw-loader"
      },
      {
        test: /\.(gif|png|jpe?g|svg|xml)$/i,
        use: "file-loader"
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./src/assets/", to: "assets/" },
      ],
    }),
    new CleanWebpackPlugin({
      root: path.resolve(__dirname, "../")
    }),
    new webpack.DefinePlugin({
      CANVAS_RENDERER: JSON.stringify(true),
      WEBGL_RENDERER: JSON.stringify(true)
    }),
    new HtmlWebpackPlugin({
      favicon: "./favicon.png",
      template: "./index.html"
    })
  ]
};
