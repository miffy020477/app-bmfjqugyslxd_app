import {
  injectedGuiListenerPlugin,
  injectOnErrorPlugin,
  makeTagger,
  monitorPlugin,
  miaodaDevPlugin
} from 'miaoda-sc-plugin'

const base = String(process.argv[process.argv.length - 1])
const publicPath = base.startsWith('http') ? base : '/'

const sentryDsn = process.env.INJECT_SENTRY_DSN
const environment = process.env.MIAODA_ENV
const appId = process.env.TARO_APP_APP_ID
const cdnHost = process.env.MIAODA_CDN_HOST || 'resource-static.cdn.bcebos.com'

export default {
  mini: {
    debugReact: true
  },
  h5: {},
  compiler: {
    type: 'vite',
    vitePlugins: [
      makeTagger({
        root: process.cwd()
      }),
      injectedGuiListenerPlugin({
        path: 'https://resource-static.cdn.bcebos.com/common/v2/injected.js'
      }),
      injectOnErrorPlugin(),
      monitorPlugin({
        scriptSrc: `https://${cdnHost}/sentry/browser.sentry.min.js`,
        sentryDsn: sentryDsn || '',
        environment: environment || '',
        appId: appId || ''
      }),
      miaodaDevPlugin({appType: 'miniapp', cdnBase: publicPath})
    ]
  }
}
