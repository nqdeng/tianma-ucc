var pegasus = require('pegasus'),
	util = pegasus.util,
	ucc = require('ucc'),
	cache = require('./cache');

var	tianma_ucc = pegasus.createPipe({
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			if (util.isString(config)) { // Fast config.
				config = {
					source: config
				};
			}

			config = util.mix({
				source: null,
				maxCachedFile:  512
			}, config);

			this._cache = cache.create({ max: config.maxCachedFile });
			this._pattern = /^((?:.+?\/){3})(.*)$/;
			this._compilers = {};
			this._source = config.source;
		},

		_getCompiler: function (base, request, callback) {
			var compilers = this._compilers;

			if (compilers[base]) {
				callback(compilers[base]);
			} else {
				request(this._source + base + 'package.json', function (err, res) {
					if (err || res.status() !== 200) {
						throw 'cannot read package.json';
					} else {
						var pkg = JSON.parse(res.data());
						compilers[base] = {
							compiler: ucc({
								modular: {
									alias: pkg.alias
								}
							}),
							source: pkg.source || '.'
						};
						callback(compilers[base]);
					}
				});
			}
		},

		get: function (context, next) {
			var request = context.request,
				response = context.response,
				source = this._source,
				cache = this._cache,
				pathname = request.pathname.substring(1),
				base, name,
				self = this,
				re, mtime, data;

			re = pathname.match(this._pattern);
			base = re[1];
			name = re[2];

			self._getCompiler(base, request, function (c) {
				request(source + base + c.source + '/' + name, function (err, res) {
					if (!err) {
						response = context.response = res;

						if (res.status() === 200) {
							if (mtime = res.head('last-modified')) {
								data = cache.get(pathname, mtime);
							}

							try {
								if (!data) {
									data = c.compiler.compile(pathname, res.binary);

									if (mtime) {
										cache.set(pathname, mtime, data);
									}
								}

								res.data(data);
							} catch (e) {
								err = e;
							}
						}
					}
					next(err);
				});
			});
		}
	});

module.exports = tianma_ucc;
