var pegasus = require('pegasus'),
    util = pegasus.util,
    ucc = require('ucc'),
    path = require('path'),
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
        this.source = config.source;
        this._compilers = {};
    },
    /**
     * Use ucc compile file
     * @param pathname {String}
     * @param request {Request}
     * @param callback {Function}
     */
    compile: function (pathname, request, callback) {
        var compilerMeta= this.getCompiler(pathname);

        if(compilerMeta.compiler){
            callback(compilerMeta.compiler, compilerMeta.base);
        }else{
            this.getPackage(pathname, request, callback);
        }
    },

    getCompiler: function(pathname){
        var compilers = this._compilers,
            compiler,base;

        for(var key in compilers){
            if(compilers.hasOwnProperty(key)){
                if(pathname.indexOf(key) == 0){
                    compiler = compilers[key];
                    base = key;
                    break;
                }
            }
        }
        return {
            compiler: compiler,
            base: base
        }
    },

    /**
     * Get package.json from URL
     * @param pathname
     * @param req
     * @param callback
     */
    getPackage: function(pathname, req, callback){
        var base = path.dirname(pathname),
            compilers = this._compilers;

        req(this.source + base + '/package.json',function(err,res){
            if(err){
                throw 'Can\'t read package.json';
            }else if(res.status() !== 200){
                this.getPackage(base, req, callback);
            }else{
                try{
                    var pkg = JSON.parse(res.data());

                    compilers[base] = {
                        compiler: ucc({
                            modular: {
                                alias: pkg.alias
                            }
                        }),
                        source: pkg.source || './'
                    };

                    callback(compilers[base], base);

                }catch (e){
                    throw e.message;
                }

            }
        }.bind(this))
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
            name,
            mtime, data;

            compiler.compile(pathname, request, function (c, base) {

                name = pathname.replace(base,'').substring(1);

                request(source + base + '/' + c.source + '/' + name, function (err, res) {
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
    }
};
