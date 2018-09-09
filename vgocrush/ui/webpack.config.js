'use strict'

const rucksack = require('rucksack-css')
const webpack = require('webpack')
const path = require('path')
const fs = require('fs')

const CopyWebpackPlugin = require('copy-webpack-plugin')

const ENV = process.env.NODE_ENV

const config = {
  context: path.join(__dirname, './client'),
  entry: {
    bundle: './index.js',
    vendor: [
      'whatwg-fetch',
      // 'style!react-toastify/dist/ReactToastify.min.css',
      'style!sweetalert2/dist/sweetalert2.min.css'
    ]
  },
  output: {
    path: path.join(__dirname, './static'),
    filename: '[name].js',
  },
  module: {
    loaders: [
      {
        test: /\.html$/,
        loader: 'file?name=[name].[ext]'
      },
      {
        test: /\.css$/,
        include: /client/,
        loaders: [
          'style-loader',
          'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]',
          'postcss-loader'
        ]
      },
      {
        test: /\.css$/,
        exclude: /client/,
        loader: 'style!css'
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loaders: [
          'react-hot',
          'babel-loader'
        ]
      },
      {
        test: /\.(mov|mp4)$/,
        loaders: [
          'url-loader?limit=30000&mimetype=video/mp4&name=[name]-[hash].[ext]'
        ]
      },
      {
        test: /\.(jpeg|png|gif|jpg)$/i,
        loaders: [
          'file?hash=sha512&digest=hex&name=[hash].[ext]',
          'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      },
      {
        test: /\.(eot|woff|woff2|ttf|svg|mp3|wav)$/,
        exclude: /client\/_assets/,
        loader: 'url-loader?limit=30000&name=[name]-[hash].[ext]'
      },
      {
        test: /\.scss$/,
        loaders: [
          'style-loader',
          'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]',
          'postcss-loader',
          'sass-loader?noIeCompat'
        ]
      }
    ],
  },
  resolve: {
    extensions: ['', '.js', '.jsx'],
    alias: {
    },
    modulesDirectories: [
      path.join(__dirname, 'client'),
      path.join(__dirname, 'node_modules')
    ]
  },
  postcss: [
    rucksack({
      autoprefixer: true
    })
  ],
  plugins: [
    new CopyWebpackPlugin([{ from: 'index.html', to: './index.html' }]),

    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      filename: ENV === 'production' ? 'vendor.[hash].js' : 'vendor.bundle.js',
      minChunks: function (module, count) {
        return module.resource && module.resource.indexOf(path.resolve(__dirname, 'client')) === -1;
      }
    }),

    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        VERSION: JSON.stringify(process.env.VERSION || 'dev'),
      },

      API_URL: JSON.stringify(process.env.API_URL || 'http://127.0.0.1:9000'),
      CHAT_URL: JSON.stringify(process.env.CHAT_URL || 'http://127.0.0.1:9001')
    }),

    new webpack.ProvidePlugin({
      'jQuery': 'jquery',
      '$': 'jquery',
      'window.jQuery': 'jquery'
    })
  ],

  devServer: {
    contentBase: './client',
    host: '0.0.0.0',
    disableHostCheck: true,
    hot: true,
    proxy: {
      '/api/*': 'http://127.0.0.1:9000',
      '/socket.io/*': 'http://127.0.0.1:9000'
    }
  }
}

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/sound',
  to: 'sound/'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/image',
  to: 'image/'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/js',
  to: 'js/'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/video',
  to: 'video/'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/fonts',
  to: 'fonts/'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/image/logo/logomark.svg',
  to: './logomark.svg'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/image/logo/logo.svg',
  to: './logo.svg'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/manifest.json',
  to: './manifest.json'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/OneSignalSDKUpdaterWorker.js',
  to: './OneSignalSDKUpdaterWorker.js'
}]))

config.plugins.push(new CopyWebpackPlugin([{
  from: 'assets/OneSignalSDKWorker.js',
  to: './OneSignalSDKWorker.js'
}]))

if(ENV === 'production') {
  config.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false
    }
  }))

  config.plugins.push(function() {
    this.plugin('done', stats => {
      const index = path.join(__dirname, 'static', 'index.html')
      const assets = stats.toJson().assetsByChunkName
      let html = fs.readFileSync(index).toString()

      const indexHtml = html
        .replace('vendor.bundle.js', assets.vendor)
        .replace('bundle.js', assets.bundle)
      fs.writeFileSync(index, indexHtml)
    })
  })

  config.output.filename = '[name].[hash].js'
}

module.exports = config
