
module.exports = runAction;
module.exports.isValidAction = isValidAction;

/**
 * Run an action string as a function.
 * @private
 * @param {Object} browser - A Puppeteer browser object.
 * @param {Object} page - A Puppeteer page object.
 * @param {Object} options - Options to pass into the action.
 * @param {String} actionString - The action string to run.
 * @returns {Promise} Returns a promise which resolves with undefined.
 */
async function runAction(browser, page, options, actionString) {

	// Find the first action that matches the given action string
	const action = module.exports.actions.find(foundAction => {
		return foundAction.match.test(actionString);
	});

	// If no action can be found, error
	if (!action) {
		throw new Error(`Failed action: "${actionString}" cannot be resolved`);
	}

	// Run the action
	options.log.debug(`Running action: ${actionString}`);
	await action.run(browser, page, options, actionString.match(action.match));
	options.log.debug('  ✔︎ action complete');
}

/**
 * Check whether an action string is valid.
 * @public
 * @param {String} actionString - The action string to validate.
 * @returns {Boolean} Returns whether the action string is valid.
 */
function isValidAction(actionString) {
	return module.exports.actions.some(foundAction => {
		return foundAction.match.test(actionString);
	});
}

/**
 * Available actions.
 * @private
 */
module.exports.actions = [

	// Action to click an element
	// E.g. "click .sign-in-button"
	{
		name: 'click-element',
		match: /^click( element)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			try {
				await page.click(selector);
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action to set an input field value
	// E.g. "set field #username to example"
	{
		name: 'set-field-value',
		match: /^set( field)? (.+) to (.+)$/i,
		run: async (browser, page, options, matches) => {
			const selector = matches[2];
			const value = matches[3];
			try {
				await page.focus(selector);
				await page.type(value);
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action to check or uncheck a checkbox/radio input
	// E.g. "check field #example"
	// E.g. "uncheck field #example"
	{
		name: 'check-field',
		match: /^(check|uncheck)( field)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const checked = (matches[1] !== 'uncheck');
			const selector = matches[3];
			try {
				/* eslint-disable no-shadow */
				await page.evaluate((selector, checked) => {
					const target = document.querySelector(selector);
					if (!target) {
						return Promise.reject(new Error('No element found'));
					}
					target.checked = checked;
					return Promise.resolve();
				}, selector, checked);
				/* eslint-enable no-shadow */
			} catch (error) {
				throw new Error(`Failed action: no element matching selector "${selector}"`);
			}
		}
	},

	// Action which waits for the URL, path, or fragment to change to the given value
	// E.g. "wait for fragment to be #example"
	// E.g. "wait for path to be /example"
	// E.g. "wait for url to be https://example.com/"
	{
		name: 'wait-for-url',
		match: /^wait for (fragment|hash|path|url)( to (not )?be)? (.+)$/i,
		run: async (browser, page, options, matches) => {
			const expectedValue = matches[4];
			const negated = (matches[3] !== undefined);
			const subject = matches[1];

			let property;
			switch (subject) {
				case 'fragment':
				case 'hash':
					property = 'hash';
					break;
				case 'path':
					property = 'pathname';
					break;
				default:
					property = 'href';
					break;
			}

			/* eslint-disable no-shadow */
			await page.waitForFunction((property, expectedValue, negated) => {
				if (negated) {
					return window.location[property] !== expectedValue;
				}
				return window.location[property] === expectedValue;
			}, {}, property, expectedValue, negated);
			/* eslint-enable no-shadow */
		}
	}

];
