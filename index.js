const bunyan = require('bunyan')
const bunyanFormat = require('bunyan-format')
const sentryStream = require('bunyan-sentry-stream')
const cacheManager = require('cache-manager')
const createApp = require('github-app')
const createWebhook = require('github-webhook-handler')
const Raven = require('raven')

const createRobot = require('./lib/robot')
const createServer = require('./lib/server')
const resolve = require('./lib/resolver')
const serializers = require('./lib/serializers')

const cache = cacheManager.caching({
  store: 'memory',
  ttl: 60 * 60 // 1 hour
})

const logger = bunyan.createLogger({
  name: 'Probot',
  level: process.env.LOG_LEVEL || 'debug',
  stream: bunyanFormat({outputMode: process.env.LOG_FORMAT || 'short'}),
  serializers
})

const defaultApps = [
  require('./lib/plugins/stats'),
  require('./lib/plugins/default')
]

// Log all unhandled rejections
process.on('unhandledRejection', logger.error.bind(logger))

module.exports = (options = {}) => {
  const webhook = createWebhook({path: options.webhookPath || '/', secret: options.secret || 'development'})
  const app = createApp({
    id: options.id,
    cert: options.cert,
    debug: process.env.LOG_LEVEL === 'trace'
  })
  const server = createServer(webhook)

  // Log all received webhooks
  webhook.on('*', event => {
    logger.trace(event, 'webhook received')
    receive(event)
  })

  // Log all webhook errors
  webhook.on('error', logger.error.bind(logger))

  // If sentry is configured, report all logged errors
  if (process.env.SENTRY_DSN) {
    Raven.disableConsoleAlerts()
    Raven.config(process.env.SENTRY_DSN, {
      autoBreadcrumbs: true
    }).install({})

    logger.addStream(sentryStream(Raven))
  }

  const robots = []

  function receive (event) {
    return Promise.all(robots.map(robot => robot.receive(event)))
  }

  function load (plugin) {
    if (typeof plugin === 'string') {
      plugin = resolve(plugin)
    }

    const robot = createRobot({app, cache, logger, catchErrors: true})

    // Connect the router from the robot to the server
    server.use(robot.router)

    // Initialize the plugin
    plugin(robot)
    robots.push(robot)

    return robot
  }

  function setup (apps) {
    apps.concat(defaultApps).forEach(app => load(app))
  }

  return {
    server,
    webhook,
    receive,
    logger,
    load,
    setup,

    start () {
      server.listen(options.port)
      logger.trace('Listening on http://localhost:' + options.port)
    }
  }
}

module.exports.createRobot = createRobot
