'use strict';

var fs = require('fs'),
	path = require('path'),
	ucc = require('libucc');

var PATTERN_PATHNAME = /^\/([^\/]+\/[^\/]+\/[^\/]+)(.*)$/;

/**
 * The filter factory.
 * @param config {Object}
 * @return {Function}
 */
module.exports = function (config) {
	config = config || {};
	
	var root = config.root || './assets',
		last = new Date(0),
		updating = false,
		compiler = {},
		queue = [];
	
	/**
	 * Avoid refresh too often.
	 * @param root {string}
	 * @param callback {Function}
	 */
	function refresh(root, callback) {
		var now = new Date;
		
		if (updating) {
			queue.push(callback);
		} else if (now - last < 5000) {
			callback(null);
		} else {
			queue.push(callback);
			updating = true;
			last = now;
			_refresh(root, function (err) {
				updating = false;
				while (queue.length > 0) {
					queue.pop()(err);
				}
			});
		}
	}

	/**
	 * Refresh projects data.
	 * @param root {string}
	 * @param callback {Function}
	 */
	function _refresh(root, callback) {
		var tmp = {};

		fs.readdir(root, function (err, entries) {
			if (err) {
				callback(err);
			} else {
				(function next(i) {
					if (i < entries.length) {
						var dir = path.resolve(root, entries[i]),
							pkg = path.join(dir, 'package.json');
							
						fs.readFile(pkg, function (err, pkg) {
							if (err) {
								next(i + 1);
							} else {
								try {
									pkg = JSON.parse(pkg);
								} catch (e) {
									err = e;
								}
								
								if (err) {
									callback(err);
								} else {
									tmp[pkg.name + '/' + pkg.version] =
										createCompiler(dir, pkg);
									next(i + 1);
								}
							}
						});
					} else {
						compiler = tmp;
						callback(null);
					}
				}(0));
			}
		});
	}
	
	/**
	 * Create compiler per project.
	 * @param dir {string}
	 * @param pkg {Object}
	 * @return {Function}
	 */
	function createCompiler(dir, pkg) {
		var compile = ucc(pkg);
		
		return function (relative, callback) {
			var pathname = path.join(dir, relative);

			fs.readFile(pathname, function (err, data) {
				if (err) {
					callback(err);
				} else {
					compile(relative, data, function (err, relative, data) {
						if (err) {
							callback(err);
						} else {
							callback(null, data);
						}
					});
				}
			});
		};
	}

	/**
	 * Map target file to the source file.
	 * @param pathname {string}
	 * @return {string}
	 */
	function map(pathname) {
		return pathname
			.replace(/\.debug(\.\w+)$/, '$1')
			.replace(/(\.\w+)\.(?:js|css)$/, '$1');
	}
	
	/**
	 * The filter.
	 * @param req {Function}
	 * @param res {Function}
	 */
	return function (req, res) {
		var re = req.pathname.match(PATTERN_PATHNAME);

		if (re) {
			var id = re[1],
				relative = map(re[2]),
				extname = path.extname(re[2]),
				compile;
				
			refresh(root, function (err) {
				if (err) {
					res(err);
				} else if (compile = compiler[id]) {
					compile(relative, function (err, data) {
						if (err) {
							if (err.code === 'ENOENT') {
								res.status(404)();
							} else {
								res(err);
							}
						} else {
							res.status(200)
								.type(extname)
								.data(data)();
						}
					});
				} else {
					req(res);
				}
			});
		} else {
			req(res);
		}
	};
};