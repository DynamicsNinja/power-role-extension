const { override } = require('customize-cra')

const overrideEntry = (config) => {
  config.entry = {
    main: './src/popup', // the extension UI
    background: './src/background',
    content: './src/content',
    inject: './src/inject', // MAIN-world fetch/XHR interceptor
  }

  return config
}

const overrideOutput = (config) => {
  config.output = {
    ...config.output,
    filename: 'static/js/[name].js',
    chunkFilename: 'static/js/[name].js',
  }

  // Each entry (content/background/inject) is loaded standalone, so they must
  // not depend on a shared runtime chunk.
  config.optimization = {
    ...config.optimization,
    runtimeChunk: false,
  }

  return config
}

// The popup HTML must only load the UI bundle. Without this, CRA injects every
// entry (including background.js and content.js) into index.html, which would
// re-register the webRequest/onMessage listeners inside the popup context and
// cause duplicate recording.
const overrideHtmlChunks = (config) => {
  config.plugins.forEach((plugin) => {
    if (plugin.constructor && plugin.constructor.name === 'HtmlWebpackPlugin') {
      plugin.options.chunks = ['main']
    }
  })

  return config
}

module.exports = {
  webpack: (config) => override(overrideEntry, overrideOutput, overrideHtmlChunks)(config),
}
