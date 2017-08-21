
const assert = require('proclaim');
const sinon = require('sinon');

describe('lib/action', () => {
	let puppeteer;
	let runAction;

	beforeEach(() => {
		puppeteer = require('../mock/puppeteer');
		runAction = require('../../../lib/action');
	});

	it('is a function', () => {
		assert.isFunction(runAction);
	});

	it('has an `actions` property', () => {
		assert.isArray(runAction.actions);
	});

	it('has an `isValidAction` method', () => {
		assert.isFunction(runAction.isValidAction);
	});

	describe('runAction(browser, page, options, actionString)', () => {
		let options;
		let resolvedValue;

		beforeEach(async () => {
			options = {
				log: {
					debug: sinon.spy()
				}
			};
			runAction.actions = [
				{
					match: /^foo/,
					run: sinon.stub().resolves()
				},
				{
					match: /^bar/,
					run: sinon.stub().resolves()
				}
			];
			resolvedValue = await runAction(puppeteer.mockBrowser, puppeteer.mockPage, options, 'bar 123');
		});

		it('calls the run function that matches the given `actionString`', () => {
			assert.notCalled(runAction.actions[0].run);
			assert.calledOnce(runAction.actions[1].run);
			assert.calledWith(runAction.actions[1].run, puppeteer.mockBrowser, puppeteer.mockPage, options);
			assert.deepEqual(runAction.actions[1].run.firstCall.args[3], [
				'bar'
			]);
		});

		it('resolves with nothing', () => {
			assert.isUndefined(resolvedValue);
		});

		describe('when `actionString` does not match an allowed action', () => {
			let rejectedError;

			beforeEach(async () => {
				runAction.actions[1].run.reset();
				try {
					await runAction(puppeteer.mockBrowser, puppeteer.mockPage, options, 'baz 123');
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with an error', () => {
				assert.instanceOf(rejectedError, Error);
				assert.strictEqual(rejectedError.message, 'Failed action: "baz 123" cannot be resolved');
			});

		});

		describe('when the action runner rejects', () => {
			let actionRunnerError;
			let rejectedError;

			beforeEach(async () => {
				actionRunnerError = new Error('action-runner-error');
				runAction.actions[1].run.rejects(actionRunnerError);
				try {
					await runAction(puppeteer.mockBrowser, puppeteer.mockPage, options, 'bar 123');
				} catch (error) {
					rejectedError = error;
				}
			});

			it('rejects with the action runner error', () => {
				assert.strictEqual(rejectedError, actionRunnerError);
			});

		});

	});

	describe('.isValidAction(actionString)', () => {

		beforeEach(() => {
			runAction.actions = [
				{
					match: /foo/i
				}
			];
		});

		it('returns `true` when the actionString matches one of the allowed actions', () => {
			assert.isTrue(runAction.isValidAction('hello foo!'));
		});

		it('returns `false` when the actionString does not match any of the allowed actions', () => {
			assert.isFalse(runAction.isValidAction('hello bar!'));
		});

	});

	describe('click-element action', () => {
		let action;

		beforeEach(() => {
			action = runAction.actions.find(foundAction => {
				return foundAction.name === 'click-element';
			});
		});

		it('has a name property', () => {
			assert.strictEqual(action.name, 'click-element');
		});

		it('has a match property', () => {
			assert.instanceOf(action.match, RegExp);
		});

		describe('.match', () => {

			it('matches all of the expected action strings', () => {
				assert.deepEqual('click .foo'.match(action.match), [
					'click .foo',
					undefined,
					'.foo'
				]);
				assert.deepEqual('click element .foo'.match(action.match), [
					'click element .foo',
					' element',
					'.foo'
				]);
				assert.deepEqual('click element .foo .bar .baz'.match(action.match), [
					'click element .foo .bar .baz',
					' element',
					'.foo .bar .baz'
				]);
			});

		});

		it('has a `run` method', () => {
			assert.isFunction(action.run);
		});

		describe('.run(browser, page, options, matches)', () => {
			let matches;
			let resolvedValue;

			beforeEach(async () => {
				matches = 'click element foo'.match(action.match);
				resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
			});

			it('clicks the specified element on the page', () => {
				assert.calledOnce(puppeteer.mockPage.click);
				assert.calledWithExactly(puppeteer.mockPage.click, matches[2]);
			});

			it('resolves with `undefined`', () => {
				assert.isUndefined(resolvedValue);
			});

			describe('when the click fails', () => {
				let clickError;
				let rejectedError;

				beforeEach(async () => {
					clickError = new Error('click error');
					puppeteer.mockPage.click.rejects(clickError);
					try {
						await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('rejects with a new error', () => {
					assert.notStrictEqual(rejectedError, clickError);
					assert.instanceOf(rejectedError, Error);
					assert.strictEqual(rejectedError.message, 'Failed action: no element matching selector "foo"');
				});

			});

		});

	});

	describe('set-field-value action', () => {
		let action;

		beforeEach(() => {
			action = runAction.actions.find(foundAction => {
				return foundAction.name === 'set-field-value';
			});
		});

		it('has a name property', () => {
			assert.strictEqual(action.name, 'set-field-value');
		});

		it('has a match property', () => {
			assert.instanceOf(action.match, RegExp);
		});

		describe('.match', () => {

			it('matches all of the expected action strings', () => {
				assert.deepEqual('set .foo to bar'.match(action.match), [
					'set .foo to bar',
					undefined,
					'.foo',
					'bar'
				]);
				assert.deepEqual('set field .foo to bar'.match(action.match), [
					'set field .foo to bar',
					' field',
					'.foo',
					'bar'
				]);
				assert.deepEqual('set field .foo .bar .baz to hello world'.match(action.match), [
					'set field .foo .bar .baz to hello world',
					' field',
					'.foo .bar .baz',
					'hello world'
				]);
			});

		});

		it('has a `run` method', () => {
			assert.isFunction(action.run);
		});

		describe('.run(browser, page, options, matches)', () => {
			let matches;
			let resolvedValue;

			beforeEach(async () => {
				matches = 'set field foo to bar'.match(action.match);
				resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
			});

			it('focuses the specified element on the page', () => {
				assert.calledOnce(puppeteer.mockPage.focus);
				assert.calledWithExactly(puppeteer.mockPage.focus, matches[2]);
			});

			it('types the specified value into the field', () => {
				assert.calledOnce(puppeteer.mockPage.type);
				assert.calledWithExactly(puppeteer.mockPage.type, matches[3]);
			});

			it('resolves with `undefined`', () => {
				assert.isUndefined(resolvedValue);
			});

			describe('when the focus fails', () => {
				let focusError;
				let rejectedError;

				beforeEach(async () => {
					focusError = new Error('focus error');
					puppeteer.mockPage.focus.rejects(focusError);
					try {
						await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('rejects with a new error', () => {
					assert.notStrictEqual(rejectedError, focusError);
					assert.instanceOf(rejectedError, Error);
					assert.strictEqual(rejectedError.message, 'Failed action: no element matching selector "foo"');
				});

			});

			describe('when the typing fails', () => {
				let typeError;
				let rejectedError;

				beforeEach(async () => {
					typeError = new Error('type error');
					puppeteer.mockPage.type.rejects(typeError);
					try {
						await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('rejects with a new error', () => {
					assert.notStrictEqual(rejectedError, typeError);
					assert.instanceOf(rejectedError, Error);
					assert.strictEqual(rejectedError.message, 'Failed action: no element matching selector "foo"');
				});

			});

		});

	});

	describe('check-field action', () => {
		let action;

		beforeEach(() => {
			action = runAction.actions.find(foundAction => {
				return foundAction.name === 'check-field';
			});
		});

		it('has a name property', () => {
			assert.strictEqual(action.name, 'check-field');
		});

		it('has a match property', () => {
			assert.instanceOf(action.match, RegExp);
		});

		describe('.match', () => {

			it('matches all of the expected action strings', () => {
				assert.deepEqual('check .foo'.match(action.match), [
					'check .foo',
					'check',
					undefined,
					'.foo'
				]);
				assert.deepEqual('check field .foo'.match(action.match), [
					'check field .foo',
					'check',
					' field',
					'.foo'
				]);
				assert.deepEqual('uncheck field .foo .bar .baz'.match(action.match), [
					'uncheck field .foo .bar .baz',
					'uncheck',
					' field',
					'.foo .bar .baz'
				]);
			});

		});

		it('has a `run` method', () => {
			assert.isFunction(action.run);
		});

		describe('.run(browser, page, options, matches)', () => {
			let matches;
			let resolvedValue;

			beforeEach(async () => {
				matches = 'check field foo'.match(action.match);
				resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
			});

			it('evaluates some JavaScript in the context of the page', () => {
				assert.calledOnce(puppeteer.mockPage.evaluate);
				assert.isFunction(puppeteer.mockPage.evaluate.firstCall.args[0]);
				assert.strictEqual(puppeteer.mockPage.evaluate.firstCall.args[1], matches[3]);
				assert.isTrue(puppeteer.mockPage.evaluate.firstCall.args[2]);
			});

			describe('evaluated JavaScript', () => {
				let mockElement;
				let originalDocument;

				beforeEach(async () => {
					mockElement = {};
					originalDocument = global.document;
					global.document = {
						querySelector: sinon.stub().returns(mockElement)
					};
					resolvedValue = await puppeteer.mockPage.evaluate.firstCall.args[0]('mock-selector', 'mock-checked');
				});

				afterEach(() => {
					global.document = originalDocument;
				});

				it('calls `document.querySelector` with the passed in selector', () => {
					assert.calledOnce(global.document.querySelector);
					assert.calledWithExactly(global.document.querySelector, 'mock-selector');
				});

				it('sets the element `checked` property to the passed in checked value', () => {
					assert.strictEqual(mockElement.checked, 'mock-checked');
				});

				it('resolves with `undefined`', () => {
					assert.isUndefined(resolvedValue);
				});

				describe('when an element with the given selector cannot be found', () => {
					let rejectedError;

					beforeEach(async () => {
						global.document.querySelector.returns(null);
						try {
							await puppeteer.mockPage.evaluate.firstCall.args[0]('mock-selector', 'mock-checked');
						} catch (error) {
							rejectedError = error;
						}
					});

					it('rejects with an error', () => {
						assert.instanceOf(rejectedError, Error);
					});

				});

			});

			it('resolves with `undefined`', () => {
				assert.isUndefined(resolvedValue);
			});

			describe('when `matches` indicates that the field should be unchecked', () => {

				beforeEach(async () => {
					puppeteer.mockPage.evaluate.reset();
					matches = 'uncheck field foo'.match(action.match);
					resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
				});

				it('passes a `false` negation parameter into the evaluate', () => {
					assert.isFalse(puppeteer.mockPage.evaluate.firstCall.args[2]);
				});

			});

			describe('when the evaluate fails', () => {
				let evaluateError;
				let rejectedError;

				beforeEach(async () => {
					evaluateError = new Error('evaluate error');
					puppeteer.mockPage.evaluate.rejects(evaluateError);
					try {
						await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
					} catch (error) {
						rejectedError = error;
					}
				});

				it('rejects with a new error', () => {
					assert.notStrictEqual(rejectedError, evaluateError);
					assert.instanceOf(rejectedError, Error);
					assert.strictEqual(rejectedError.message, 'Failed action: no element matching selector "foo"');
				});

			});

		});

	});

	describe('wait-for-url action', () => {
		let action;

		beforeEach(() => {
			action = runAction.actions.find(foundAction => {
				return foundAction.name === 'wait-for-url';
			});
		});

		it('has a name property', () => {
			assert.strictEqual(action.name, 'wait-for-url');
		});

		it('has a match property', () => {
			assert.instanceOf(action.match, RegExp);
		});

		describe('.match', () => {

			it('matches all of the expected action strings', () => {
				assert.deepEqual('wait for fragment #foo'.match(action.match), [
					'wait for fragment #foo',
					'fragment',
					undefined,
					undefined,
					'#foo'
				]);
				assert.deepEqual('wait for fragment to be #foo'.match(action.match), [
					'wait for fragment to be #foo',
					'fragment',
					' to be',
					undefined,
					'#foo'
				]);
				assert.deepEqual('wait for hash to be #foo'.match(action.match), [
					'wait for hash to be #foo',
					'hash',
					' to be',
					undefined,
					'#foo'
				]);
				assert.deepEqual('wait for path to be /foo'.match(action.match), [
					'wait for path to be /foo',
					'path',
					' to be',
					undefined,
					'/foo'
				]);
				assert.deepEqual('wait for url to be https://example.com/'.match(action.match), [
					'wait for url to be https://example.com/',
					'url',
					' to be',
					undefined,
					'https://example.com/'
				]);
				assert.deepEqual('wait for fragment to not be #bar'.match(action.match), [
					'wait for fragment to not be #bar',
					'fragment',
					' to not be',
					'not ',
					'#bar'
				]);
				assert.deepEqual('wait for hash to not be #bar'.match(action.match), [
					'wait for hash to not be #bar',
					'hash',
					' to not be',
					'not ',
					'#bar'
				]);
				assert.deepEqual('wait for path to not be /sso/login'.match(action.match), [
					'wait for path to not be /sso/login',
					'path',
					' to not be',
					'not ',
					'/sso/login'
				]);
				assert.deepEqual('wait for url to not be https://example.com/login'.match(action.match), [
					'wait for url to not be https://example.com/login',
					'url',
					' to not be',
					'not ',
					'https://example.com/login'
				]);
			});

		});

		it('has a `run` method', () => {
			assert.isFunction(action.run);
		});

		describe('.run(browser, page, options, matches)', () => {
			let matches;
			let resolvedValue;

			beforeEach(async () => {
				matches = 'wait for path to be foo'.match(action.match);
				resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
			});

			it('waits for a function to evaluate to `true`', () => {
				assert.calledOnce(puppeteer.mockPage.waitForFunction);
				assert.isFunction(puppeteer.mockPage.waitForFunction.firstCall.args[0]);
				assert.deepEqual(puppeteer.mockPage.waitForFunction.firstCall.args[1], {});
				assert.strictEqual(puppeteer.mockPage.waitForFunction.firstCall.args[2], 'pathname');
				assert.strictEqual(puppeteer.mockPage.waitForFunction.firstCall.args[3], matches[4]);
				assert.isFalse(puppeteer.mockPage.waitForFunction.firstCall.args[4]);
			});

			describe('evaluated JavaScript', () => {
				let originalWindow;
				let returnValue;

				beforeEach(() => {
					originalWindow = global.window;
					global.window = {
						location: {
							'mock-property': 'value'
						}
					};
					returnValue = puppeteer.mockPage.waitForFunction.firstCall.args[0]('mock-property', 'value', false);
				});

				afterEach(() => {
					global.window = originalWindow;
				});

				it('returns `true`', () => {
					assert.isTrue(returnValue);
				});

				describe('when the location property does not match the expected value', () => {

					beforeEach(() => {
						returnValue = puppeteer.mockPage.waitForFunction.firstCall.args[0]('mock-property', 'incorrect-value', false);
					});

					it('returns `false`', () => {
						assert.isFalse(returnValue);
					});

				});

				describe('when the negated property is `true`', () => {

					beforeEach(() => {
						returnValue = puppeteer.mockPage.waitForFunction.firstCall.args[0]('mock-property', 'value', true);
					});

					it('returns `false`', () => {
						assert.isFalse(returnValue);
					});

				});

				describe('when the negated property is `true` and the location property does not match the expected value', () => {

					beforeEach(() => {
						returnValue = puppeteer.mockPage.waitForFunction.firstCall.args[0]('mock-property', 'incorrect-value', true);
					});

					it('returns `true`', () => {
						assert.isTrue(returnValue);
					});

				});

			});

			it('resolves with `undefined`', () => {
				assert.isUndefined(resolvedValue);
			});

			describe('when `matches` indicates that the subject is "fragment"', () => {

				beforeEach(async () => {
					puppeteer.mockPage.waitForFunction.reset();
					matches = 'wait for fragment to be foo'.match(action.match);
					resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
				});

				it('passes the expected property name into the wait function', () => {
					assert.strictEqual(puppeteer.mockPage.waitForFunction.firstCall.args[2], 'hash');
				});

			});

			describe('when `matches` indicates that the subject is "hash"', () => {

				beforeEach(async () => {
					puppeteer.mockPage.waitForFunction.reset();
					matches = 'wait for hash to be foo'.match(action.match);
					resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
				});

				it('passes the expected property name into the wait function', () => {
					assert.strictEqual(puppeteer.mockPage.waitForFunction.firstCall.args[2], 'hash');
				});

			});

			describe('when `matches` indicates that the subject is "url"', () => {

				beforeEach(async () => {
					puppeteer.mockPage.waitForFunction.reset();
					matches = 'wait for url to be foo'.match(action.match);
					resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
				});

				it('passes the expected property name into the wait function', () => {
					assert.strictEqual(puppeteer.mockPage.waitForFunction.firstCall.args[2], 'href');
				});

			});

			describe('when `matches` includes a negation like "to not be"', () => {

				beforeEach(async () => {
					puppeteer.mockPage.waitForFunction.reset();
					matches = 'wait for path to not be foo'.match(action.match);
					resolvedValue = await action.run(puppeteer.mockBrowser, puppeteer.mockPage, {}, matches);
				});

				it('passes a `true` negation parameter into the wait function', () => {
					assert.isTrue(puppeteer.mockPage.waitForFunction.firstCall.args[4]);
				});

			});

		});

	});

});
