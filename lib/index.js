var pegasus = require('pegasus'),
    util = pegasus.util,
    ucc = require('ucc'),
    path = require('path'),
    cache = require('./cache'),
    url = require('url');

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
        this._compilersQueue = [];
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
            callback(null, compilerMeta.compiler, compilerMeta.base);
        }else{
            this.getPackage(pathname, request, callback);
        }
    },
    /**
     * Get compiler and base from pathname
     * @param pathname
     * @returns {*}
     */
    getCompiler: function(pathname){
        var compilers = this._compilers,
            compiler = {},
            base = path.dirname(pathname);

       if(compilers[base]){
            return {
               compiler: compilers[base],
               base: base
           };
        }else{

            for(var i=0; i < this._compilersQueue.length; i++){
                if(base.indexOf(this._compilersQueue[i].base) == 0){
                    compiler = this._compilersQueue[i];
                    break;
                }
            }
            return compiler;
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
            compilers = this._compilers,
            pkg;


        req(this.source.replace(/\/$/,'') + '/' + base + '/package.json' ,function(err, res){

            if(err){
                callback(err);
            }else {
                // break endless loop
                if(res.status() !== 200 && base !=='.'){
                    this.getPackage(base, req, callback);
                }else{
                    if(res.status() == 200){
                        try {
                            pkg = JSON.parse(res.data());
                        } catch (e) {
                            err = new Error('JSON syntax error!');
                        }
                    }else{
                        //if package.json not exists,faker package.json
                        pkg = {
                            source: './',
                            alias: {},
                            name: '',
                            version: ''
                        };
                    }
                    //if JSON syntax,throw error
                    if(err){
                        callback(err);
                    }else{
                        compilers[base] = {
                            compiler: ucc({
                                alias: pkg.alias
                            }),
                            source: pkg.source || './'
                        };
                        this._compilersQueue.push({
                            compiler: compilers[base],
                            base: base
                        });
                        this._compilersQueue.sort(function(a, b){
                             return a.base < b.base;
                        });
                        callback(err, compilers[base], base);
                    }
                }
            }

        }.bind(this));
    }
});

module.exports = function(config){
    var compiler = new TianmaUCC(config);

    /**
     * Generate pegasus pipeline
     * @return {Function}
     */
    return function (context, next) {
        var request = context.request,
            response = context.response,
            source = compiler.source.replace(/\/$/,''),
            cache = compiler.cache,
            pathname = request.pathname.substring(1),
            name,
            uri,
            mtime, data;

            compiler.compile(pathname, request, function (err, c, base) {

                if(err){
                    next(err);
                }else{
                    //if base is current directory,nothing to do
                    //else get real path by replace base
                    if(base != '.'){
                        name = pathname.replace(base,'');
                    }else{
                        name = pathname;
                    }

                    uri = source + '/' + path.join(base, c.source, name).replace(/\\/g,'/');

                    request(uri, function (err, res) {
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
                }
            });
    }
};
