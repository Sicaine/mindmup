/*global beforeEach, describe, expect, it, MAPJS, MM, jasmine, observable, jQuery, afterEach */
describe('MM.ContentStatusUpdater', function () {
	'use strict';
	var underTest, content,
		mapControllerStub = function (content) {
			var mc  = {};
			mc.addEventListener = function (eventType, listener) {
				listener('', content);
			};
			return mc;
		};
	beforeEach(function () {
		content = MAPJS.content({
			attr: {
				'test-statuses': {
					'passing': {
						style: {
							background: '#ffffff'
						}
					},
					'in-progress': {
						priority: 1,
						style: {
							background: '#00ffff'
						}
					},
					'failure': {
						priority: 999,
						style: {
							background: '#ff0000'
						}
					}

				},
				style: {
					background: '#000000',
					otherStyle: 'foo'
				}
			},
			id: 1,
			ideas: {
				1: {
					id: 11,
					ideas: {
						1: {
							id: 111,
							ideas: {
								1: {
									id: 1111
								}
							}
						},
						2: {
							id: 112
						}
					}
				}
			}
		});
		underTest = new MM.ContentStatusUpdater('test-status', 'test-statuses', mapControllerStub(content));
	});
	describe('updates the node style:', function () {
		it('should change the node to be the color associated with the status', function () {
			underTest.updateStatus(1, 'passing');

			expect(content.attr.style.background).toBe('#ffffff');
		});
		it('should preserve the existing styles where they are not overridden', function () {
			underTest.updateStatus(1, 'passing');
			expect(content.attr.style.otherStyle).toBe('foo');
		});
		it('should return true if successful', function () {
			expect(underTest.updateStatus(1, 'passing')).toBeTruthy();
		});
		it('should leave the node style unchanged if the style is not recognised', function () {
			expect(underTest.updateStatus(1, 'dodgyStatus')).toBeFalsy();
			expect(content.attr.style).toEqual({
				background: '#000000',
				otherStyle: 'foo'
			});
		});
		it('should return false if idea with id not found', function () {
			expect(underTest.updateStatus(31412, 'passing')).toBeFalsy();
		});
		it('should change the style of non root ideas', function () {
			underTest.updateStatus(11, 'passing');
			expect(content.getAttrById(11, 'style')).toEqual({background: '#ffffff'});
		});
	});
	describe('persists the status', function () {
		it('sets the status attribute', function () {
			underTest.updateStatus(1, 'passing');
			expect(content.getAttrById(1, 'test-status')).toEqual('passing');
		});
	});
	describe('propagates status changes to parents', function () {
		var runs = [
				['',			'in-progress',	'in-progress',		'priority wins over no status'],
				['',			'passing',		'same as before',	'without priority the status does not propagate if there are siblings with no status'],
				['passing',		'passing',		'passing',			'all the child nodes have the same status'],
				['passing',		'in-progress',	'in-progress',		'priority wins over no priority'],
				['in-progress',	'in-progress',	'in-progress',		'same priority propagates'],
				['in-progress',	'failure',		'failure',			'higher priority wins'],
				['failure',		'in-progress',	'failure',			'higher priority wins even if on sibling'],
			],
			checkPropatation = function (sibling, child, expectedParent) {
				content.updateAttr(11, 'test-status', 'same as before');
				content.updateAttr(112, 'test-status', sibling);

				underTest.updateStatus(111, child);

				expect(content.getAttrById(11, 'test-status')).toEqual(expectedParent);
			};
		runs.forEach(function (args) {
			it(args[3], checkPropatation.bind(this, args[0], args[1], args[2]));
		});
		it('propagates all the way to the top', function () {
			underTest.updateStatus(111, 'failure');
			expect(content.getAttrById(11, 'test-status')).toEqual('failure');
			expect(content.getAttrById(1, 'test-status')).toEqual('failure');
		});

		it('evaluates each level independently when propagating', function () {
			content.updateAttr(11, 'test-status', 'same as before');
			content.updateAttr(112, 'test-status', 'failure');

			underTest.updateStatus(1111, 'in-progress');

			expect(content.getAttrById(111, 'test-status')).toEqual('in-progress');
			expect(content.getAttrById(11, 'test-status')).toEqual('failure');
		});
		it('propagates does not propagate down', function () {
			underTest.updateStatus(121, 'failure');
			expect(content.getAttrById(1211, 'test-status')).not.toEqual('failure');
		});

	});
	describe('clear', function () {
		var content, underTest;
		beforeEach(function () {
			content = MAPJS.content({
				id: 1,
				attr: { status: 'yes', style: { background: 'green' } },
				ideas: {
					1: {
						id: 11,
						attr: { status: 'no', style: { background: 'yellow' } },
						ideas: {
							1: {
								id: 111,
								attr: { style: { background: 'yellow' } },
							}
						}
					}
				}
			});
			underTest = new MM.ContentStatusUpdater('status', 'test-statuses', mapControllerStub(content));
		});
		it('deletes all status attributes and drops styling for any elements with status', function () {
			underTest.clear();
			expect(content.getAttr('status')).toBeFalsy();
			expect(content.getAttr('style')).toBeFalsy();
			expect(content.findSubIdeaById(11).getAttr('status')).toBeFalsy();
			expect(content.findSubIdeaById(11).getAttr('style')).toBeFalsy();
		});
		it('does not drop styling of non-status elements', function () {
			underTest.clear();
			expect(content.findSubIdeaById(111).getAttr('style')).toEqual({background: 'yellow'});
		});
	});
	describe("setStatusConfig", function () {
		var content, underTest,
			configOne = { 'passing': { style: { background: '#ffffff' } } };
		beforeEach(function () {
			content = MAPJS.content({
				id: 1,
				attr: { 'test-statuses': 'old' }
			});
			underTest = new MM.ContentStatusUpdater('status', 'test-statuses', mapControllerStub(content));
		});
		it("changes status configuration on current content", function () {
			underTest.setStatusConfig(configOne);
			expect(content.getAttr('test-statuses')).toEqual(configOne);
		});
		it("changes status configuration on current content", function () {
			underTest.setStatusConfig(false);
			expect(content.getAttr('test-statuses')).toBeFalsy();
		});
		it("dispatches config changed event when configuration changes", function () {
			var listener = jasmine.createSpy();
			underTest.addEventListener("configChanged", listener);
			underTest.setStatusConfig(configOne);
			expect(listener).toHaveBeenCalledWith(configOne);
		});
		it("ignores non numerical priority", function () {
			underTest.setStatusConfig({ 'passing': { priority: 'abc', style: { background: '#ffffff' } } });
			expect(content.getAttr('test-statuses')).toEqual(configOne);
		});
		it("parses numerical priorities if provided as strings", function () {
			underTest.setStatusConfig({ 'passing': { priority: '2', style: { background: '#ffffff' } } });
			expect(content.getAttr('test-statuses')).toEqual({ 'passing': { priority: '2', style: { background: '#ffffff' } } });
		});
	});
	describe("mapController bindings", function () {
		var mapController, underTest, configOne, configTwo, firstContent, secondContent;
		beforeEach(function () {
			mapController = observable({});
			underTest = new MM.ContentStatusUpdater('status', 'test-statuses', mapController);
			configOne = { 'passing': { style: { background: '#ffffff' } } };
			configTwo = { 'failing': { style: { background: '#ffffff' } } };
			firstContent = MAPJS.content({
				id: 1,
				attr: { 'test-statuses': configOne }
			});
			secondContent = MAPJS.content({
				id: 1,
				attr: { 'test-statuses': configTwo }
			});
		});
		it("fires configChanged when the content changes", function () {
			var listener = jasmine.createSpy();
			underTest.addEventListener("configChanged", listener);
			mapController.dispatchEvent('mapLoaded', '', firstContent);
			expect(listener).toHaveBeenCalledWith(configOne);
		});
	});
});
describe("progressStatusUpdateWidget", function () {
	'use strict';
	var elementHTML = '<div>  ' +
		'	<ul data-mm-role="status-list">' +
		'			<li data-mm-progress-visible="inactive"><a data-mm-role="start" data-mm-progress-type="double"></a></li>' +
		'			<li data-mm-progress-visible="inactive"><a data-mm-role="start" data-mm-progress-type="single"></a></li>' +
		'			<li data-mm-role="status-template">' +
		'				<a data-mm-role="set-status">' +
		'					<div data-mm-role="status-color" class="progress-color">&nbsp;</div>&nbsp;' +
		'					<span data-mm-role="status-name"></span>' +
		'					<span data-mm-role="status-key"></span>' +
		'					<span data-mm-role="status-priority"></span>' +
		'				</a>' +
		'			</li>' +
		'			<li class="divider" data-mm-progress-visible="active"></li>' +
		'			<li data-mm-progress-visible="active"><a data-mm-role="toggle-toolbar" ></a></li>' +
		'			<li data-mm-progress-visible="active"><a data-mm-role="clear" ></a></li>' +
		'			<li data-mm-progress-visible="active"><a data-mm-role="deactivate" ></a></li>' +
		'			<li data-mm-progress-visible="active"><a data-mm-role="save" ></a></li>' +
		'		</ul>' +
		'	</div>',
		mapModel,
		updater,
		domElement,
		expectVisibilitySettings = function (activeDisplay, inactiveDisplay) {
			var active = domElement.find('[data-mm-progress-visible=active]'),
				inactive = domElement.find('[data-mm-progress-visible=inactive]');
			active.each(function () {
				expect(jQuery(this).css('display')).toBe(activeDisplay);
			});
			inactive.each(function () {
				expect(jQuery(this).css('display')).toBe(inactiveDisplay);
			});
		},
		singleConfig = { passed: {style: {background: '#FF0000' }}},
		doubleConfig = { passed: {description: 'Passed desc', style: {background: 'rgb(0, 0, 255)'}},
						failed: {description: 'Failed desc', priority: 1, style: {background: 'rgb(255, 0, 0)'}}};

	beforeEach(function () {
		mapModel = observable({});
		updater = observable({});
		domElement = jQuery(elementHTML).appendTo('body').progressStatusUpdateWidget(updater, mapModel, {
			single: singleConfig,
			double: doubleConfig
		});
	});
	afterEach(function () {
		domElement.detach();
	});
	describe("menu visibility", function () {
		it("removes items with visible=active when by default", function () {
			expectVisibilitySettings('none', 'list-item');
		});
		it("shows active and removes inactive when there is an active configuration", function () {
			updater.dispatchEvent('configChanged', singleConfig);
			expectVisibilitySettings('list-item', 'none');
		});
		it("hides active and shows inactive when there is no active configuration", function () {
			updater.dispatchEvent('configChanged', singleConfig);
			updater.dispatchEvent('configChanged', false);
			expectVisibilitySettings('none', 'list-item');
		});
		it("clones the template for each status in the config when config changes, setting the fields from the config", function () {
			updater.dispatchEvent('configChanged', doubleConfig);
			var statuses = domElement.find('[data-mm-role=progress]');
			expect(statuses.size()).toBe(2);
			expect(statuses.first().find('[data-mm-role=status-name]').text()).toBe('Failed desc');
			expect(statuses.first().attr('data-mm-progress-key')).toBe('failed');
			expect(statuses.first().find('[data-mm-role=status-priority]').text()).toBe('1');
			expect(statuses.first().find('[data-mm-role=status-color]').css('background-color')).toBe('rgb(255, 0, 0)');
			expect(statuses.last().find('[data-mm-role=status-name]').text()).toBe('Passed desc');
			expect(statuses.last().find('[data-mm-role=status-color]').css('background-color')).toBe('rgb(0, 0, 255)');
			expect(statuses.last().attr('data-mm-progress-key')).toBe('passed');
			expect(statuses.last().find('[data-mm-role=status-priority]').text()).toBe('');
		});
		it("orders by priority, highest priority first, then items without priority in alphabetic order", function () {
			var numericOrderConfig = {
				'kalpha': {description: 'F', style: {background: 'rgb(255, 0, 0)'}},
				'k777': {description: 'F', priority: 777, style: {background: 'rgb(255, 0, 0)'}},
				'k999': {description: 'F', priority: 999, style: {background: 'rgb(255, 0, 0)'}},
				'k888': {description: 'F', priority: 888, style: {background: 'rgb(255, 0, 0)'}},
			},
				statuses;
			updater.dispatchEvent('configChanged', numericOrderConfig);
			statuses = domElement.find('[data-mm-role=progress]');
			expect(statuses.size()).toBe(4);
			expect(statuses.eq(0).attr('data-mm-progress-key')).toBe('k999');
			expect(statuses.eq(1).attr('data-mm-progress-key')).toBe('k888');
			expect(statuses.eq(2).attr('data-mm-progress-key')).toBe('k777');
			expect(statuses.eq(3).attr('data-mm-progress-key')).toBe('kalpha');
		});
		it("supports inputs for color, setting the value", function () {
			var inputElHTML = '<div>  ' +
				'	<ul data-mm-role="status-list">' +
				'			<li data-mm-role="status-template">' +
				'				<input data-mm-role="status-color"></input>' +
				'			</li>' +
				'		</ul>' +
				'	</div>';
			updater.dispatchEvent('configChanged', singleConfig);
			expect(domElement.find('[data-mm-role=status-color]').val()).toBe('#FF0000');
		});

	});
	describe("action binding", function () {
		beforeEach(function () {
			updater.dispatchEvent('configChanged', singleConfig);
		});
		it("drops config when clicked on deactivate", function () {
			updater.setStatusConfig = jasmine.createSpy();
			domElement.find('[data-mm-role=deactivate]').click();
			expect(updater.setStatusConfig).toHaveBeenCalledWith(false);
		});
		it("sets configuration to the one specified with data-mm-progress-type when clicked on start", function () {
			updater.setStatusConfig = jasmine.createSpy();
			domElement.find('[data-mm-progress-type=double]').click();
			expect(updater.setStatusConfig).toHaveBeenCalledWith(doubleConfig);
		});
		it("clears statuses clicked on clear", function () {
			updater.clear = jasmine.createSpy();
			domElement.find('[data-mm-role=clear]').click();
			expect(updater.clear).toHaveBeenCalled();
		});
		it("puts body class progress-toolbar-active when clicked on toggle-toolbar if class does not exist", function () {
			jQuery('body').removeClass('progress-toolbar-active');
			domElement.find('[data-mm-role=toggle-toolbar]').click();
			expect(jQuery('body').hasClass('progress-toolbar-active')).toBeTruthy();
		});
		it("removes body class progress-toolbar-active when clicked on toggle-toolbar if class exists", function () {
			jQuery('body').addClass('progress-toolbar-active');
			domElement.find('[data-mm-role=toggle-toolbar]').click();
			expect(jQuery('body').hasClass('progress-toolbar-active')).toBeFalsy();
		});
		it("updates currently activated nodes when clicked on a progress status link", function () {
			updater.updateStatus = jasmine.createSpy();
			mapModel.applyToActivated = function (func) {
				func(17);
			};
			domElement.find('[data-mm-role=progress] [data-mm-role=set-status]').click();
			expect(updater.updateStatus).toHaveBeenCalledWith(17, 'passed');
		});
		it("serialises current list of statuses to updater when clicked on save link", function () {
			var newStatusHtml = '<li data-mm-role="progress" data-mm-progress-key="Key 1">'
				+ '<input data-mm-role="status-color" value="#0FF0FF"/>'
				+ '<span data-mm-role="status-name">Name 1</span>'
				+ '<span data-mm-role="status-priority">1</span>'
				+ '</li>'
				+ '<li data-mm-role="progress" data-mm-progress-key="Key 2">'
				+ '<input data-mm-role="status-color" value="#FFFFFF"/>'
				+ '<span data-mm-role="status-name">No Priority</span>'
				+ '<span data-mm-role="status-priority"></span>'
				+ '</li>';
			domElement.find('[data-mm-role=progress]').remove();
			domElement.find('[data-mm-role=status-list]').append(jQuery(newStatusHtml));
			updater.setStatusConfig = jasmine.createSpy();
			domElement.find('[data-mm-role=save]').click();
			expect(updater.setStatusConfig).toHaveBeenCalledWith({
				'Key 1': {
					description: 'Name 1',
					style: { background: '#0FF0FF'},
					priority: '1'
				},
				'Key 2': {
					description: 'No Priority',
					style: { background: '#FFFFFF' }
				}
			});
		});
		it("autogenerates keys for statuses without a key, numerically skipping any existing values", function () {
			var newStatusHtml = '<li data-mm-role="progress" >'
				+ '<input data-mm-role="status-color" value="#0FF0FF"/>'
				+ '<span data-mm-role="status-name">Name 1</span>'
				+ '<span data-mm-role="status-priority">1</span>'
				+ '</li>'
				+ '<li data-mm-role="progress" data-mm-progress-key="6">'
				+ '<input data-mm-role="status-color" value="#FFFFFF"/>'
				+ '<span data-mm-role="status-name">No Priority</span>'
				+ '<span data-mm-role="status-priority"></span>'
				+ '</li>';
			domElement.find('[data-mm-role=progress]').remove();
			domElement.find('[data-mm-role=status-list]').append(jQuery(newStatusHtml));
			updater.setStatusConfig = jasmine.createSpy();
			domElement.find('[data-mm-role=save]').click();
			expect(updater.setStatusConfig).toHaveBeenCalledWith({
				'7': {
					description: 'Name 1',
					style: { background: '#0FF0FF'},
					priority: '1'
				},
				'6': {
					description: 'No Priority',
					style: { background: '#FFFFFF' }
				}
			});
		});
		it("autogenerates keys starting from 1 when no keys are defined", function () {
			var newStatusHtml = '<li data-mm-role="progress" >'
				+ '<input data-mm-role="status-color" value="#0FF0FF"/>'
				+ '<span data-mm-role="status-name">Name 1</span>'
				+ '<span data-mm-role="status-priority">1</span>'
				+ '</li>'
				+ '<li data-mm-role="progress">'
				+ '<input data-mm-role="status-color" value="#FFFFFF"/>'
				+ '<span data-mm-role="status-name">No Priority</span>'
				+ '<span data-mm-role="status-priority"></span>'
				+ '</li>';
			domElement.find('[data-mm-role=progress]').remove();
			domElement.find('[data-mm-role=status-list]').append(jQuery(newStatusHtml));
			updater.setStatusConfig = jasmine.createSpy();
			domElement.find('[data-mm-role=save]').click();
			expect(updater.setStatusConfig).toHaveBeenCalledWith({
				'1': {
					description: 'Name 1',
					style: { background: '#0FF0FF'},
					priority: '1'
				},
				'2': {
					description: 'No Priority',
					style: { background: '#FFFFFF' }
				}
			});
		});
	});
});
