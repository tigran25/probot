import * as Logger from 'bunyan'
import * as cacheManager from 'cache-manager'
import * as express from 'express'
import {Application, WebhookEvent} from './application'
import {Context} from './context'
import {createApp} from './github-app'
import {logger} from './logger'
import {resolve} from './resolver'
import {createServer} from './server'
import {createWebhookProxy} from './webhook-proxy'

const Webhooks = require('@octokit/webhooks')
const logRequestErrors = require('./middleware/log-request-errors')

const cache = cacheManager.caching({
  store: 'memory',
  ttl: 60 * 60 // 1 hour
})

const defaultApps = [
  require('./plugins/sentry'),
  require('./plugins/stats'),
  require('./plugins/default')
]

export class Probot {
  public server: express.Application
  public webhook: any
  public logger: Logger

  private options: Options
  private apps: Application[]
  private app: () => string

  constructor(options: Options) {
    options.webhookPath = options.webhookPath || '/'
    options.secret = options.secret || 'development'
    this.options = options
    this.logger = logger
    this.apps = []
    this.webhook = new Webhooks({path: options.webhookPath, secret: options.secret})
    this.app = createApp({ id: options.id, cert: options.cert })
    this.server = createServer({webhook: this.webhook.middleware, logger})

    // Log all received webhooks
    this.webhook.on('*', (event: any) => {
      const webhookEvent = { ...event, event: event.name }
      delete webhookEvent.name

      this.receive(webhookEvent)
    })

    // Log all webhook errors
    this.webhook.on('error', this.errorHandler)
  }

  public errorHandler (err) {
    switch (err.message) {
      case 'X-Hub-Signature does not match blob signature':
      case 'No X-Hub-Signature found on request':
        logger.error('Go to https://github.com/settings/apps/YOUR_APP and verify that the Webhook secret matches the value of the WEBHOOK_SECRET environment variable.')
        break
      case 'error:0906D06C:PEM routines:PEM_read_bio:no start line':
      case '{"message":"A JSON web token could not be decoded","documentation_url":"https://developer.github.com/v3"}':
        logger.error('Your private key (usually a .pem file) is not correct. Go to https://github.com/settings/apps/YOUR_APP and generate a new PEM file. If you\'re deploying to Now, visit https://probot.github.io/docs/deployment/#now.')
        break
      default:
        logger.error(err)
    }
  }

  public receive (event: WebhookEvent) {
    this.logger.debug({event}, 'Webhook received')
    return Promise.all(this.apps.map(app => app.receive(event)))
  }

  public load (plugin: string | Plugin) {
    if (typeof plugin === 'string') {
      plugin = resolve(plugin) as Plugin
    }

    const app = new Application({app: this.app, cache, catchErrors: true})

    // Connect the router from the app to the server
    this.server.use(app.router)

    // Initialize the plugin
    plugin(app)
    this.apps.push(app)

    return app
  }

  public setup (apps: Array<string | Plugin>) {
    // Log all unhandled rejections
    process.on('unhandledRejection', this.errorHandler)

    // Load the given apps along with the default apps
    apps.concat(defaultApps).forEach(app => this.load(app))

    // Register error handler as the last middleware
    this.server.use(logRequestErrors)
  }

  public start () {
    if (this.options.webhookProxy) {
      createWebhookProxy({
        logger,
        path: this.options.webhookPath,
        port: this.options.port,
        url: this.options.webhookProxy,
      })
    }

    this.server.listen(this.options.port)
    logger.info('Listening on http://localhost:' + this.options.port)
  }
}

export const createProbot = (options: Options) => new Probot(options)

export type Plugin = (app: Application) => void

export interface Options {
  webhookPath?: string
  secret?: string,
  id: number,
  cert: string,
  webhookProxy?: string,
  port?: number
}

export { Logger, Context, Application }
