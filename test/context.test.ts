const fs = require('fs')
const path = require('path')

import {Context} from '../src/context'
import {OctokitError} from '../src/github'

describe('Context', () => {
  let event
  let context

  beforeEach(() => {
    event = {
      event: 'push',
      payload: {
        issue: {number: 4},
        repository: {
          name: 'probot',
          owner: {login: 'bkeepers'},
        },
      }
    }

    context = new Context(event, {} as any, {} as any)
  })

  it('inherits the payload', () => {
    expect(context.payload).toBe(event.payload)
  })

  describe('repo', () => {
    it('returns attributes from repository payload', () => {
      expect(context.repo()).toEqual({owner: 'bkeepers', repo: 'probot'})
    })

    it('merges attributes', () => {
      expect(context.repo({foo: 1, bar: 2})).toEqual({
        bar: 2, foo: 1, owner: 'bkeepers', repo: 'probot',
      })
    })

    it('overrides repo attributes', () => {
      expect(context.repo({owner: 'muahaha'})).toEqual({
        owner: 'muahaha', repo: 'probot'
      })
    })

    // The `repository` object on the push event has a different format than the other events
    // https://developer.github.com/v3/activity/events/types/#pushevent
    it('properly handles the push event', () => {
      event.payload = require('./fixtures/webhook/push')

      context = new Context(event, {} as any, {} as any)
      expect(context.repo()).toEqual({owner: 'bkeepers-inc', repo: 'test'})
    })

    it('return error for context.repo() when repository doesn\'t exist', () => {
      delete context.payload.repository
      try {
        context.repo()
      } catch (e) {
        expect(e.message).toMatch('context.repo() is not supported')
      }
    })
  })

  describe('issue', () => {
    it('returns attributes from repository payload', () => {
      expect(context.issue()).toEqual({owner: 'bkeepers', repo: 'probot', number: 4})
    })

    it('merges attributes', () => {
      expect(context.issue({foo: 1, bar: 2})).toEqual({
        bar: 2, foo: 1, number: 4, owner: 'bkeepers', repo: 'probot',
      })
    })

    it('overrides repo attributes', () => {
      expect(context.issue({owner: 'muahaha', number: 5})).toEqual({
        number: 5, owner: 'muahaha', repo: 'probot'
      })
    })
  })

  describe('config', () => {
    let github

    function readConfig (fileName) {
      const configPath = path.join(__dirname, 'fixtures', 'config', fileName)
      const content = fs.readFileSync(configPath, {encoding: 'utf8'})
      return {data: {content: Buffer.from(content).toString('base64')}}
    }

    beforeEach(() => {
      github = {
        repos: {
          getContent: jest.fn()
        }
      }

      context = new Context(event, github, {} as any)
    })

    it('gets a valid configuration', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(Promise.resolve(readConfig('basic.yml')))
      const config = await context.config('test-file.yml')

      expect(github.repos.getContent).toHaveBeenCalledWith({
        owner: 'bkeepers',
        path: '.github/test-file.yml',
        repo: 'probot',
      })
      expect(config).toEqual({
        bar: 7,
        baz: 11,
        foo: 5,
      })
    })

    it('returns null when the file is missing', async () => {
      const error: OctokitError = {
        code: 404,
        message: 'An error occurred',
        name: 'OctokitError',
        status: 'Not Found',
      };

      github.repos.getContent = jest.fn().mockReturnValue(Promise.reject(error))

      expect(await context.config('test-file.yml')).toBe(null)
    })

    it('returns the default config when the file is missing and default config is passed', async () => {
      const error: OctokitError = {
        code: 404,
        message: 'An error occurred',
        name: 'OctokitError',
        status: 'Not Found',
      };

      github.repos.getContent = jest.fn().mockReturnValue(Promise.reject(error))
      const defaultConfig = {
        bar: 7,
        baz: 11,
        foo: 5,
      }
      const contents = await context.config('test-file.yml', defaultConfig)
      expect(contents).toEqual(defaultConfig)
    })

    it('throws when the configuration file is malformed', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(Promise.resolve(readConfig('malformed.yml')))

      let e
      let contents
      try {
        contents = await context.config('test-file.yml')
      } catch (err) {
        e = err
      }

      expect(contents).toBeUndefined()
      expect(e).toBeDefined()
      expect(e.message).toMatch(/^end of the stream or a document separator/)
    })

    it('throws when loading unsafe yaml', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(readConfig('evil.yml'))

      let e
      let config
      try {
        config = await context.config('evil.yml')
      } catch (err) {
        e = err
      }

      expect(config).toBeUndefined()
      expect(e).toBeDefined()
      expect(e.message).toMatch(/unknown tag/)
    })

    it('returns an empty object when the file is empty', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(readConfig('empty.yml'))

      const contents = await context.config('test-file.yml')

      expect(contents).toEqual({})
    })

    it('overwrites default config settings', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(Promise.resolve(readConfig('basic.yml')))
      const config = await context.config('test-file.yml', {foo: 10})

      expect(github.repos.getContent).toHaveBeenCalledWith({
        owner: 'bkeepers',
        path: '.github/test-file.yml',
        repo: 'probot',
      })
      expect(config).toEqual({
        bar: 7,
        baz: 11,
        foo: 5,
      })
    })

    it('uses default settings to fill in missing options', async () => {
      github.repos.getContent = jest.fn().mockReturnValue(Promise.resolve(readConfig('missing.yml')))
      const config = await context.config('test-file.yml', {bar: 7})

      expect(github.repos.getContent).toHaveBeenCalledWith({
        owner: 'bkeepers',
        path: '.github/test-file.yml',
        repo: 'probot',
      })
      expect(config).toEqual({
        bar: 7,
        baz: 11,
        foo: 5,
      })
    })
  })
})
