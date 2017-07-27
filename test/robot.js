const expect = require('expect');
const Context = require('../lib/context');
const createRobot = require('../lib/robot');

describe('Robot', function () {
  let robot;
  let event;
  let spy;

  beforeEach(function () {
    robot = createRobot();
    robot.auth = () => {};

    event = {
      event: 'test',
      payload: {
        action: 'foo',
        installation: {id: 1}
      }
    };

    spy = expect.createSpy();
  });

  describe('constructor', () => {
    it('takes a logger', () => {
      const logger = {
        trace: expect.createSpy(),
        debug: expect.createSpy(),
        info: expect.createSpy(),
        warn: expect.createSpy(),
        error: expect.createSpy(),
        fatal: expect.createSpy()
      };
      robot = createRobot({logger});

      robot.log('hello world');
      expect(logger.debug).toHaveBeenCalledWith('hello world');
    });
  });

  describe('on', function () {
    it('calls callback when no action is specified', async function () {
      robot.on('test', spy);

      expect(spy).toNotHaveBeenCalled();
      await robot.receive(event);
      expect(spy).toHaveBeenCalled();
      expect(spy.calls[0].arguments[0]).toBeA(Context);
      expect(spy.calls[0].arguments[0].payload).toBe(event.payload);
    });

    it('calls callback with same action', async function () {
      robot.on('test.foo', spy);

      await robot.receive(event);
      expect(spy).toHaveBeenCalled();
    });

    it('does not call callback with different action', async function () {
      robot.on('test.nope', spy);

      await robot.receive(event);
      expect(spy).toNotHaveBeenCalled();
    });

    it('calls callback with *', async function () {
      robot.on('*', spy);

      await robot.receive(event);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('receive', () => {
    it('delivers the event', async () => {
      const spy = expect.createSpy();
      robot.on('test', spy);

      await robot.receive(event);

      expect(spy).toHaveBeenCalled();
    });

    it('waits for async events to resolve', async () => {
      const spy = expect.createSpy();

      robot.on('test', () => {
        return new Promise(resolve => {
          setTimeout(() => {
            spy();
            resolve();
          }, 1);
        });
      });

      await robot.receive(event);

      expect(spy).toHaveBeenCalled();
    });

    it('returns a reject errors thrown in plugins', async () => {
      robot.on('test', () => {
        throw new Error('error from plugin');
      });

      try {
        await robot.receive(event);
        throw new Error('expected error to be raised from plugin');
      } catch (err) {
        expect(err.message).toEqual('error from plugin');
      }
    });
  });

  describe('error handling', () => {
    it('logs errors throw from handlers', async () => {
      const error = new Error('testing');
      robot.log.error = expect.createSpy();

      robot.on('test', () => {
        throw error;
      });

      try {
        await robot.receive(event);
      } catch (err) {
        // Expected
      }

      expect(robot.log.error).toHaveBeenCalledWith(error);
    });
  });
});
