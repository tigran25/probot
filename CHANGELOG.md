# Changelog

## 0.8.0 (2017-07-27)

Enhancements:

- Add helper for loading config from a repository ([#141](https://github.com/probot/probot/pull/141))
- Add `probot simulate` command for simulating the delivery of a webhook ([#136](https://github.com/probot/probot/pull/136))

[View full changelog](https://github.com/probot/probot/compare/v0.7.5...v0.8.0)

## 0.7.5 (2017-07-13)

Fixes:

- Line breaks in the `PRIVATE_KEY` environment variable are now replaced.

[View full changelog](https://github.com/probot/probot/compare/v0.7.4...v0.7.5)

## 0.7.4 (2017-06-30)

Fixes:

- This fixes a bug introduced in [#165](https://github.com/probot/probot/pull/165) and adds a test to show that webhook delivery is happening. ([#168](https://github.com/probot/probot/pull/168))

[View full changelog](https://github.com/probot/probot/compare/v0.7.3...v0.7.4)

## 0.7.3 (2017-06-30)

Enhancements:

- Refactor some internals to improve the testability of plugins. Docs coming soon after building out tests for several of the plugins.

[View full changelog](https://github.com/probot/probot/compare/v0.7.2...v0.7.3)

## 0.7.2 (2017-06-27)

- Internal: update from `github-integration` to renamed `github-app` for handling GitHub App authentication.

[View full changelog](https://github.com/probot/probot/compare/v0.7.1...v0.7.2)

## 0.7.1 (2017-06-16)

Fixes:

- Fix error introduced in 0.7.0 that was preventing events from being received. ([#161](https://github.com/probot/probot/pull/161))

[View full changelog](https://github.com/probot/probot/compare/v0.7.0...v0.7.1)

## 0.7.0 (2017-06-15)

Breaking Changes:

- Callbacks passed to `robot.on` used to take two arguments—`event` and `context`. The second was pretty much just a fancy version of the first, and you really need the second to do anything useful, so the first argument has been dropped. (Technically, the second is passed as both arguments for now to preserve backward compatibility, but this won't be the case forever, so go update your plugins). You will see this warning when loading plugins:

    ```
    DEPRECATED: Event callbacks now only take a single `context` argument.
    at module.exports.robot (/path/to/your/plugin.js:3:9)
    ```

    Before:

    ```js
    robot.on('issues.opened', async (event, context) => {
      log('Event and context? What is the difference?', events, context);
    });
    ```

    After:

    ```js
    robot.on('issues.opened', async context => {
      log('Sweet, just one arg', context, context.payload);
    });
    ```

Enhancements:

- Fix issue where localtunnel would often not reconnect when you restart the probot process. ([#157](https://github.com/probot/probot/pull/157))


[View full changelog](https://github.com/probot/probot/compare/v0.6.0...v0.7.0)

## v0.6.0 (2017-06-09)

Breaking Changes:

- Update to [node-github](https://github.com/mikedeboer/node-github) v9, which namespaces all responses with a `data` attribute. (https://github.com/mikedeboer/node-github/pull/505). This is likely to be a breaking change for all plugins.

    Before:

    ```js
    const data = await github.search.issues(params);
    data.items.forEach(item => doTheThing(issue));
    ```

    After:

    ```js
    const res = await github.search.issues(params);
    res.data.items.forEach(item => doTheThing(issue));
    ```

- "GitHub Integrations" were renamed to "GitHub Apps". The `INTEGRATION_ID` environment variable has been deprecated. Use `APP_ID` instead. ([#154](https://github.com/probot/probot/pull/154))

Enhancements:

- Errors thrown in handlers from plugins were being silently ignored. That's not cool. Now, they're being caught and logged.
 ([#152](https://github.com/probot/probot/pull/152))

[View full changelog](https://github.com/probot/probot/compare/v0.5.0...v0.6.0)
