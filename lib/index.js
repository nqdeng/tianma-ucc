var pegasus = require('pegasus'),
    util = pegasus.util,
    ucc = require('ucc'),
    cache = require('./cache');

/**
 * A UCC pipeline for tianma
 * @class TinmaUCC
 */
var TianmaUCC = util.inherit(Object, {
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
            maxCachedFile: 512
        }, config);

        this.cache = cache.create({ max: config.maxCachedFile });
        this._compilers = {};
        this.source = config.source;
    },
    /**
     * Use ucc compile file
     * @param base {String}
     * @param request {Request}
     * @param callback {Function}
     */
    compile: function (base, request, callback) {
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
    }
});

module.exports = function(config){
    var compiler = new TianmaUCC(config);

    /**
     * Generate pegasus pipeline
     */
    return function (context, next) {
        var request = context.request,
            response = context.response,
            source = compiler.source,
            cache = compiler.cache,
            pathname = request.pathname.substring(1),
            base, name,
            re, mtime, data,
            pattern = /^((?:.+?\/){3})(.*)$/;

        re = pathname.match(pattern);
        if (re) {
            base = re[1];
            name = re[2];
            compiler.compile(base, request, function (c) {

                request(source + base + c.source + '/' + name, function (err, res) {
                    if (!err) {
                        response = context.response = res;
                        if (res.status() === 200) {
                            if (mtime = res.head('last-modified')) {
                                data = cache.get(pathname, mtime);
                            }
                            try {
                                if (!data) {
                                    data = c.compiler.compile(pathname, res.binary).data;

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
        } else {
            next();
        }
    }
};
