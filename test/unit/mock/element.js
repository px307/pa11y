
const sinon = require('sinon');

module.exports = createMockElement;

function createMockElement(data = {}) {
	const element = Object.assign({
		childNodes: [],
		contains: sinon.stub().returns(false),
		id: null,
		innerHTML: 'mock-html',
		isEqualNode: sinon.stub().returns(false),
		nodeType: 1,
		outerHTML: '<element>mock-html</element>',
		parentNode: null,
		tagName: 'ELEMENT'
	}, data);

	if (element.parentNode) {
		element.parentNode.childNodes.push(element);
	}
	if (element.childNodes.length) {
		element.childNodes.forEach(childNode => {
			childNode.parentNode = element;
		});
	}

	return element;
}
