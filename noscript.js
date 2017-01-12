/* ../node_modules/vow/lib/vow.js begin */
/**
 * Vow
 *
 * Copyright (c) 2012-2013 Filatov Dmitry (dfilatov@yandex-team.ru)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * @version 0.3.13
 */

(function(global) {

var Promise = function(val) {
    this._res = val;

    this._isFulfilled = !!arguments.length;
    this._isRejected = false;

    this._fulfilledCallbacks = [];
    this._rejectedCallbacks = [];
    this._progressCallbacks = [];
};

Promise.prototype = {
    valueOf : function() {
        return this._res;
    },

    isFulfilled : function() {
        return this._isFulfilled;
    },

    isRejected : function() {
        return this._isRejected;
    },

    isResolved : function() {
        return this._isFulfilled || this._isRejected;
    },

    fulfill : function(val) {
        if(this.isResolved()) {
            return;
        }

        this._isFulfilled = true;
        this._res = val;

        this._callCallbacks(this._fulfilledCallbacks, val);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    reject : function(err) {
        if(this.isResolved()) {
            return;
        }

        this._isRejected = true;
        this._res = err;

        this._callCallbacks(this._rejectedCallbacks, err);
        this._fulfilledCallbacks = this._rejectedCallbacks = this._progressCallbacks = undef;
    },

    notify : function(val) {
        if(this.isResolved()) {
            return;
        }

        this._callCallbacks(this._progressCallbacks, val);
    },

    then : function(onFulfilled, onRejected, onProgress, ctx) {
        if(onRejected && !isFunction(onRejected)) {
            ctx = onRejected;
            onRejected = undef;
        }
        else if(onProgress && !isFunction(onProgress)) {
            ctx = onProgress;
            onProgress = undef;
        }

        var promise = new Promise(),
            cb;

        if(!this._isRejected) {
            cb = { promise : promise, fn : isFunction(onFulfilled)? onFulfilled : undef, ctx : ctx };
            this._isFulfilled?
                this._callCallbacks([cb], this._res) :
                this._fulfilledCallbacks.push(cb);
        }

        if(!this._isFulfilled) {
            cb = { promise : promise, fn : onRejected, ctx : ctx };
            this._isRejected?
                this._callCallbacks([cb], this._res) :
                this._rejectedCallbacks.push(cb);
        }

        this.isResolved() || this._progressCallbacks.push({ promise : promise, fn : onProgress, ctx : ctx });

        return promise;
    },

    fail : function(onRejected, ctx) {
        return this.then(undef, onRejected, ctx);
    },

    always : function(onResolved, ctx) {
        var _this = this,
            cb = function() {
                return onResolved.call(this, _this);
            };

        return this.then(cb, cb, ctx);
    },

    progress : function(onProgress, ctx) {
        return this.then(undef, undef, onProgress, ctx);
    },

    spread : function(onFulfilled, onRejected, ctx) {
        return this.then(
            function(val) {
                return onFulfilled.apply(this, val);
            },
            onRejected,
            ctx);
    },

    done : function(onFulfilled, onRejected, onProgress, ctx) {
        this
            .then(onFulfilled, onRejected, onProgress, ctx)
            .fail(throwException);
    },

    delay : function(delay) {
        var timer,
            promise = this.then(function(val) {
                var promise = new Promise();
                timer = setTimeout(
                    function() {
                        promise.fulfill(val);
                    },
                    delay);

                return promise;
            });

        promise.always(function() {
            clearTimeout(timer);
        });

        return promise;
    },

    timeout : function(timeout) {
        var promise = new Promise(),
            timer = setTimeout(
                function() {
                    promise.reject(Error('timed out'));
                },
                timeout);

        promise.sync(this);
        promise.always(function() {
            clearTimeout(timer);
        });

        return promise;
    },

    sync : function(promise) {
        promise.then(
            this.fulfill,
            this.reject,
            this.notify,
            this);
    },

    _callCallbacks : function(callbacks, arg) {
        var len = callbacks.length;
        if(!len) {
            return;
        }

        var isResolved = this.isResolved(),
            isFulfilled = this.isFulfilled();

        nextTick(function() {
            var i = 0, cb, promise, fn;
            while(i < len) {
                cb = callbacks[i++];
                promise = cb.promise;
                fn = cb.fn;

                if(fn) {
                    var ctx = cb.ctx,
                        res;
                    try {
                        res = ctx? fn.call(ctx, arg) : fn(arg);
                    }
                    catch(e) {
                        promise.reject(e);
                        continue;
                    }

                    isResolved?
                        Vow.isPromise(res)?
                            (function(promise) {
                                res.then(
                                    function(val) {
                                        promise.fulfill(val);
                                    },
                                    function(err) {
                                        promise.reject(err);
                                    },
                                    function(val) {
                                        promise.notify(val);
                                    });
                            })(promise) :
                            promise.fulfill(res) :
                        promise.notify(res);
                }
                else {
                    isResolved?
                        isFulfilled?
                            promise.fulfill(arg) :
                            promise.reject(arg) :
                        promise.notify(arg);
                }
            }
        });
    }
};

var Vow = {
    Promise : Promise,

    promise : function(val) {
        return arguments.length?
            Vow.isPromise(val)?
                val :
                new Promise(val) :
            new Promise();
    },

    when : function(obj, onFulfilled, onRejected, onProgress, ctx) {
        return Vow.promise(obj).then(onFulfilled, onRejected, onProgress, ctx);
    },

    fail : function(obj, onRejected, ctx) {
        return Vow.when(obj, undef, onRejected, ctx);
    },

    always : function(obj, onResolved, ctx) {
        return Vow.promise(obj).always(onResolved, ctx);
    },

    progress : function(obj, onProgress, ctx) {
        return Vow.promise(obj).progress(onProgress, ctx);
    },

    spread : function(obj, onFulfilled, onRejected, ctx) {
        return Vow.promise(obj).spread(onFulfilled, onRejected, ctx);
    },

    done : function(obj, onFulfilled, onRejected, onProgress, ctx) {
        Vow.promise(obj).done(onFulfilled, onRejected, onProgress, ctx);
    },

    isPromise : function(obj) {
        return obj && isFunction(obj.then);
    },

    valueOf : function(obj) {
        return Vow.isPromise(obj)? obj.valueOf() : obj;
    },

    isFulfilled : function(obj) {
        return Vow.isPromise(obj)? obj.isFulfilled() : true;
    },

    isRejected : function(obj) {
        return Vow.isPromise(obj)? obj.isRejected() : false;
    },

    isResolved : function(obj) {
        return Vow.isPromise(obj)? obj.isResolved() : true;
    },

    fulfill : function(val) {
        return Vow.when(val, undef, function(err) {
            return err;
        });
    },

    reject : function(err) {
        return Vow.when(err, function(val) {
            var promise = new Promise();
            promise.reject(val);
            return promise;
        });
    },

    resolve : function(val) {
        return Vow.isPromise(val)? val : Vow.when(val);
    },

    invoke : function(fn) {
        try {
            return Vow.promise(fn.apply(global, slice.call(arguments, 1)));
        }
        catch(e) {
            return Vow.reject(e);
        }
    },

    forEach : function(promises, onFulfilled, onRejected, keys) {
        var len = keys? keys.length : promises.length,
            i = 0;
        while(i < len) {
            Vow.when(promises[keys? keys[i] : i], onFulfilled, onRejected);
            ++i;
        }
    },

    all : function(promises) {
        var resPromise = new Promise(),
            isPromisesArray = isArray(promises),
            keys = isPromisesArray?
                getArrayKeys(promises) :
                getObjectKeys(promises),
            len = keys.length,
            res = isPromisesArray? [] : {};

        if(!len) {
            resPromise.fulfill(res);
            return resPromise;
        }

        var i = len,
            onFulfilled = function() {
                if(!--i) {
                    var j = 0;
                    while(j < len) {
                        res[keys[j]] = Vow.valueOf(promises[keys[j++]]);
                    }
                    resPromise.fulfill(res);
                }
            },
            onRejected = function(err) {
                resPromise.reject(err);
            };

        Vow.forEach(promises, onFulfilled, onRejected, keys);

        return resPromise;
    },

    allResolved : function(promises) {
        var resPromise = new Promise(),
            isPromisesArray = isArray(promises),
            keys = isPromisesArray?
                getArrayKeys(promises) :
                getObjectKeys(promises),
            i = keys.length,
            res = isPromisesArray? [] : {};

        if(!i) {
            resPromise.fulfill(res);
            return resPromise;
        }

        var onProgress = function() {
                --i || resPromise.fulfill(promises);
            };

        Vow.forEach(promises, onProgress, onProgress, keys);

        return resPromise;
    },

    allPatiently : function(promises) {
        return Vow.allResolved(promises).then(function() {
            var isPromisesArray = isArray(promises),
                keys = isPromisesArray?
                    getArrayKeys(promises) :
                    getObjectKeys(promises),
                rejectedPromises, fulfilledPromises,
                len = keys.length, i = 0, key, promise;

            if(!len) {
                return isPromisesArray? [] : {};
            }

            while(i < len) {
                key = keys[i++];
                promise = promises[key];
                if(Vow.isRejected(promise)) {
                    rejectedPromises || (rejectedPromises = isPromisesArray? [] : {});
                    isPromisesArray?
                        rejectedPromises.push(promise.valueOf()) :
                        rejectedPromises[key] = promise.valueOf();
                }
                else if(!rejectedPromises) {
                    (fulfilledPromises || (fulfilledPromises = isPromisesArray? [] : {}))[key] = Vow.valueOf(promise);
                }
            }

            if(rejectedPromises) {
                throw rejectedPromises;
            }

            return fulfilledPromises;
        });
    },

    any : function(promises) {
        var resPromise = new Promise(),
            len = promises.length;

        if(!len) {
            resPromise.reject(Error());
            return resPromise;
        }

        var i = 0, err,
            onFulfilled = function(val) {
                resPromise.fulfill(val);
            },
            onRejected = function(e) {
                i || (err = e);
                ++i === len && resPromise.reject(err);
            };

        Vow.forEach(promises, onFulfilled, onRejected);

        return resPromise;
    },

    delay : function(val, timeout) {
        return Vow.promise(val).delay(timeout);
    },

    timeout : function(val, timeout) {
        return Vow.promise(val).timeout(timeout);
    }
};

var undef,
    nextTick = (function() {
        var fns = [],
            enqueueFn = function(fn) {
                return fns.push(fn) === 1;
            },
            callFns = function() {
                var fnsToCall = fns, i = 0, len = fns.length;
                fns = [];
                while(i < len) {
                    fnsToCall[i++]();
                }
            };

        if(typeof setImmediate === 'function') { // ie10, nodejs >= 0.10
            return function(fn) {
                enqueueFn(fn) && setImmediate(callFns);
            };
        }

        if(typeof process === 'object' && process.nextTick) { // nodejs < 0.10
            return function(fn) {
                enqueueFn(fn) && process.nextTick(callFns);
            };
        }

        if(global.postMessage) { // modern browsers
            var isPostMessageAsync = true;
            if(global.attachEvent) {
                var checkAsync = function() {
                        isPostMessageAsync = false;
                    };
                global.attachEvent('onmessage', checkAsync);
                global.postMessage('__checkAsync', '*');
                global.detachEvent('onmessage', checkAsync);
            }

            if(isPostMessageAsync) {
                var msg = '__promise' + +new Date,
                    onMessage = function(e) {
                        if(e.data === msg) {
                            e.stopPropagation && e.stopPropagation();
                            callFns();
                        }
                    };

                global.addEventListener?
                    global.addEventListener('message', onMessage, true) :
                    global.attachEvent('onmessage', onMessage);

                return function(fn) {
                    enqueueFn(fn) && global.postMessage(msg, '*');
                };
            }
        }

        var doc = global.document;
        if('onreadystatechange' in doc.createElement('script')) { // ie6-ie8
            var createScript = function() {
                    var script = doc.createElement('script');
                    script.onreadystatechange = function() {
                        script.parentNode.removeChild(script);
                        script = script.onreadystatechange = null;
                        callFns();
                };
                (doc.documentElement || doc.body).appendChild(script);
            };

            return function(fn) {
                enqueueFn(fn) && createScript();
            };
        }

        return function(fn) { // old browsers
            enqueueFn(fn) && setTimeout(callFns, 0);
        };
    })(),
    throwException = function(e) {
        nextTick(function() {
            throw e;
        });
    },
    isFunction = function(obj) {
        return typeof obj === 'function';
    },
    slice = Array.prototype.slice,
    toStr = Object.prototype.toString,
    isArray = Array.isArray || function(obj) {
        return toStr.call(obj) === '[object Array]';
    },
    getArrayKeys = function(arr) {
        var res = [],
            i = 0, len = arr.length;
        while(i < len) {
            res.push(i++);
        }
        return res;
    },
    getObjectKeys = Object.keys || function(obj) {
        var res = [];
        for(var i in obj) {
            obj.hasOwnProperty(i) && res.push(i);
        }
        return res;
    };

var defineAsGlobal = true;
if(typeof exports === 'object') {
    module.exports = Vow;
    defineAsGlobal = false;
}

if(typeof modules === 'object') {
    modules.define('vow', function(provide) {
        provide(Vow);
    });
    defineAsGlobal = false;
}

if(typeof define === 'function') {
    define(function(require, exports, module) {
        module.exports = Vow;
    });
    defineAsGlobal = false;
}

defineAsGlobal && (global.Vow = Vow);

})(this);

/* ../node_modules/vow/lib/vow.js end */

/* ../src/vow.log.js begin */
// небольшая обертка для Vow.Promise, позволяющая логировать все исключения через стандартные механизмы ns
Vow.Promise.prototype.__reject = Vow.Promise.prototype.reject;
Vow.Promise.prototype.reject = function(err) {
    if (err instanceof Error) {
        ns.log.exception('promise.exception', err);
    }
    this.__reject(err);
};

/* ../src/vow.log.js end */

(function(window, document) {
    "use strict";
    /* ../node_modules/nommon/lib/no.base.js begin */
//  ---------------------------------------------------------------------------------------------------------------  //
//  no
//  ---------------------------------------------------------------------------------------------------------------  //

var no = {};

//  ---------------------------------------------------------------------------------------------------------------  //

no.de = (typeof window === 'undefined');

//  ---------------------------------------------------------------------------------------------------------------  //

no.inherit = function(ctor, base, mixin) {
    var F = function() {};
    F.prototype = base.prototype;
    var proto = ctor.prototype = new F();

    if (mixin) {
        if ( Array.isArray(mixin) ) {
            for (var i = 0, l = mixin.length; i < l; i++) {
                no.extend( proto, mixin[i] );
            }
        } else {
            no.extend(proto, mixin);
        }
    }

    proto.super_ = base.prototype;
    proto.constructor = ctor;

    return ctor;
};

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
no.extend = function(dest) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var src = arguments[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.nop = function() {};

//  ---------------------------------------------------------------------------------------------------------------  //

no.true = function() { return true; };
no.false = function() { return false; };

//  ---------------------------------------------------------------------------------------------------------------  //

no.value = function(value) {
    return function() {
        return value;
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @param {string} msg
    @return {function()}
*/
no.logger = function(msg) {
    if (msg) {
        return function() {
            var args = [].slice.call(arguments);
            console.log.apply(null, [ msg ].concat(args) );
        };
    }

    return console.log;
};

//  ---------------------------------------------------------------------------------------------------------------  //

if ( no.de ) {
    no.next = function(callback) {
        process.nextTick(callback);
    };
} else {
    //  FIXME: Посмотреть на postMessage и т.д.
    no.next = function(callback) {
        setTimeout(callback, 0);
    };
}

//  ---------------------------------------------------------------------------------------------------------------  //

if ( no.de ) {
    module.exports = no;
}

//  ---------------------------------------------------------------------------------------------------------------  //


/* ../node_modules/nommon/lib/no.base.js end */

    /* ../node_modules/nommon/lib/no.parser.js begin */
var no = no || require('./no.base.js');

//  ---------------------------------------------------------------------------------------------------------------  //

no.Parser = function(rules, tokens) {
    this._rules = rules;
    this._tokens = tokens || {};
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Parser.prototype.start = function(input, id) {
    this.input = input;
    this.p = 0;
    this.s = input; // this.s === this.input.substr(this.p);

    var ast = this.parse(id);

    if (this.s) {
        this.error('End of string expected');
    }

    return ast;
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Parser.prototype.parse = function(id, params) {
    var rule = this._rules[id];

    var p = this.p;

    var ast = rule.call(this, params);

    ast._start = p;
    ast._end = this.p;
    ast._input = this.input;

    return ast;
};

no.Parser.prototype.test = function(id) {
    var token = this._tokens[id];

    if (token) {
        var r = token.exec(this.s);
        return r && r[0];
    }

    if ( this.la(id.length) === id ) {
        return id;
    }
};

no.Parser.prototype.match = function(id) {
    var r = this.test(id);

    if (!r) {
        this.error('Token ' + id + ' expected');
    }

    this.move(r.length);

    return r;
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Parser.prototype.la = function(n) {
    return this.s.substr(0, n || 1);
};

no.Parser.prototype.move = function(n) {
    n || (( n = 1 ));
    this.s = this.s.substr(n);
    this.p += n;
};

no.Parser.prototype.skip = function() {
    var r = /^\s+/.exec(this.s);
    if (r) {
        this.move( r[0].length );
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.Parser.prototype.error = function(msg) {
    throw Error(msg + ' at ' + this.p + ': ' + this.s);
};

//  ---------------------------------------------------------------------------------------------------------------  //


/* ../node_modules/nommon/lib/no.parser.js end */

    /* ../node_modules/nommon/lib/no.jpath.js begin */
var no = no || require('./no.base.js');

if ( no.de ) {
    require('./no.parser.js');

    module.exports = no;
}

//  ---------------------------------------------------------------------------------------------------------------  //

(function() {

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @constructor
    @param {Object} data
*/
function JNode(data) {
    this.data = data;
}

//  ---------------------------------------------------------------------------------------------------------------  //

JNode.prototype.empty = new JNodeset();

/**
    @return {boolean}
*/
JNode.prototype.isEmpty = function() {
    return false;
};

/**
    @param {string} name
    @param {JNodeset=} result
    @return {(JNode|JNodeset)}
*/
JNode.prototype.nametest = function(name, result) {
    var data = this.data;
    if (!data) {
        return this.empty;
    }

    if ( Array.isArray(data) ) {
        result || (( result = new JNodeset() ));
        for (var i = 0; i < data.length; i++) {
            ( new JNode( data[i] ) ).nametest(name, result);
        }
        return result;
    }

    var r = data[name];
    if (r === undefined) {
        return this.empty;
    }

    var node = new JNode(r);
    if (result) {
        return result.push(node);
    }

    return node;
};

/**
    @param {JNodeset=} result
    @return {JNodeset}
*/
JNode.prototype.startest = function(result) {
    result || (( result = new JNodeset() ));

    var data = this.data;
    if ( Array.isArray(data) ) {
        for (var i = 0; i < data.length; i++) {
            ( new JNode( data[i] ) ).startest(result);
        }
    } else {
        for (var key in data) {
            this.nametest(key, result);
        }
    }

    return result;
};

/**
    @param {function(JNode, JNode): boolean} filter
    @param {JNode} root
    @return {(JNode|JNodeset)}
*/
//  FIXME: Добавить тут четвертый параметр result?
JNode.prototype.pred = function(filter, root, vars, funcs) {
    var data = this.data;

    if ( Array.isArray(data) ) {
        var result = new JNodeset();
        for (var i = 0; i < data.length; i++) {
            var node = new JNode( data[i] );
            if ( filter(node, root, vars, funcs) ) {
                result.push(node);
            }
        }
        return result;
    }

    return ( filter(this, root, vars, funcs) ) ? this : this.empty;
};

/**
    @param {number} index
    @return {JNodeset}
*/
JNode.prototype.index = function(index, root, vars, funcs) {
    var data = this.data;

    if ( Array.isArray(data) ) {
        var r = data[ index(this, root, vars, funcs) ];
        return (r !== undefined) ? ( new JNode(r) ).toNodeset() : this.empty;
    }

    return (index === 0) ? this : this.empty;
};

/**
    @return {Array}
*/
JNode.prototype.toArray = function() {
    return [ this.data ];
};

/**
    @return {JNodeset}
*/
JNode.prototype.toNodeset = function() {
    return ( new JNodeset() ).push(this);
};

JNode.prototype.scalar = function() {
    var data = this.data;
    return (typeof data === 'object') ? '' : data;
};

/**
    @return {boolean}
*/
JNode.prototype.boolean = function() {
    var data = this.data;

    if ( Array.isArray(data) ) {
        //  FIXME: Нужно ли отдельно рассматривать случай, когда это массив
        //  из одного falsy элемента?
        return data.length > 0;
    }

    return !!data;
};

/**
    @param {JNodeset} nodeset
    @return {boolean}
*/
JNode.prototype.cmpN = function(nodeset) {
    var data = this.data;

    if ( Array.isArray(data) ) {
        for (var i = 0; i < data.length; i++) {
            if ( cmpN(new JNode( data[i] ), nodeset) ) {
                return true;
            }
        }
        return false;
    }

    return cmpN(this, nodeset);
};

function cmpN(node, nodeset) {
    if (nodeset instanceof JNode) {
        return cmpS( nodeset, node.scalar() );
    }

    var nodes = nodeset.nodes;
    var value = node.scalar();
    for (var i = 0; i < nodes.length; i++) {
        if ( value == nodes[i].scalar() ) {
            return true;
        }
    }
    return false;
}

JNode.prototype.cmpS = function(scalar) {
    return cmpS(this, scalar);
};

function cmpS(node, scalar) {
    var data = node.data;

    if ( Array.isArray(data) ) {
        for (var i = 0; i < data.length; i++) {
            if ( ( new JNode( data[i] ) ).scalar() == scalar ) {
                return true;
            }
        }
        return false;
    }

    return node.scalar() == scalar;
}

//  ---------------------------------------------------------------------------------------------------------------  //

/**
    @constructor
*/
function JNodeset() {
    this.nodes = [];
}

//  ---------------------------------------------------------------------------------------------------------------  //

JNodeset.prototype.empty = JNode.prototype.empty;

/**
    @return {boolean}
*/
JNodeset.prototype.isEmpty = function() {
    return !this.nodes.length;
};

/**
    @param {JNode} node
    @return {JNodeset}
*/
JNodeset.prototype.push = function(node) {
    this.nodes.push(node);

    return this;
};

/**
    @param {string} name
    @param {JNodeset=} result
    @return {JNodeset}
*/
JNodeset.prototype.nametest = function(name, result) {
    var nodes = this.nodes;
    result || (( result = new JNodeset() ));
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].nametest(name, result);
    }
    return result;
};

/**
    @param {JNodeset=} result
    @return {JNodeset}
*/
JNodeset.prototype.startest = function(result) {
    var nodes = this.nodes;
    result || (( result = new JNodeset() ));
    for (var i = 0; i < nodes.length; i++) {
        nodes[i].startest(result);
    }
    return result;
};

/**
    @param {function(JNode, JNode): boolean} filter
    @param {JNode} root
    @param {JNodeset=} result
    @return {JNodeset}
*/
JNodeset.prototype.pred = function(filter, root, vars, funcs) {
    var nodes = this.nodes;
    //  FIXME: result || (( result = new JNodeset() ));
    var result = new JNodeset();
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if ( filter(node, root, vars, funcs) ) {
            result.push(node);
        }
    }
    return result;
};

/**
    @param {number} index
    @return {JNodeset}
*/
JNodeset.prototype.index = function(index) {
    var node = this.nodes[index];

    if (node !== undefined) {
        return ( new JNodeset() ).push(node);
    }

    return this.empty;
};

/**
    @return {Array}
*/
JNodeset.prototype.toArray = function() {
    var r = [];
    var nodes = this.nodes;
    for (var i = 0; i < nodes.length; i++) {
        r.push( nodes[i].data );
    }
    return r;
};

JNodeset.prototype.scalar = function() {
    var nodes = this.nodes;
    return (nodes.length) ? nodes[0].scalar() : '';
};

/**
    @return {boolean}
*/
JNodeset.prototype.boolean = function() {
    var nodes = this.nodes;
    return (nodes.length) ? nodes[0].boolean() : false;
};

/**
    @param {JNodeset} nodeset
    @return {boolean}
*/
JNodeset.prototype.cmpN = function(nodeset) {
    var nodes = this.nodes;
    for (var i = 0, l = nodes.length; i < l; i++) {
        if ( nodes[i].cmpN(nodeset) ) {
            return true;
        }
    }
    return false;
};

JNodeset.prototype.cmpS = function(scalar) {
    var nodes = this.nodes;
    for (var i = 0, l = nodes.length; i < l; i++) {
        if ( nodes[i].cmpS(scalar) ) {
            return true;
        }
    }
    return false;
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.JNode = JNode;
no.JNodeset = JNodeset;

//  ---------------------------------------------------------------------------------------------------------------  //

//  ---------------------------------------------------------------------------------------------------------------  //
//  Grammar
//  ---------------------------------------------------------------------------------------------------------------  //

//  ---------------------------------------------------------------------------------------------------------------  //
//  Grammar consts
//  ---------------------------------------------------------------------------------------------------------------  //

//  Types.
//
var TYPE_SCALAR = 'scalar';
var TYPE_NODESET = 'nodeset';
var TYPE_BOOL = 'boolean';

//  Priorities of binary operators.
//
var BINOPS = {
    '*': 6,
    '/': 6,
    '%': 6,
    '+': 5,
    '-': 5,
    '<=': 4,
    '>=': 4,
    '<': 4,
    '>': 4,
    '==': 3,
    '!=': 3,
    '&&': 2,
    '||': 1
};

//  ---------------------------------------------------------------------------------------------------------------  //
//  Grammar tokens
//  ---------------------------------------------------------------------------------------------------------------  //

var tokens = {};

//  ---------------------------------------------------------------------------------------------------------------  //

tokens.SELF = /^\.(?![a-zA-Z_*.[])/;
tokens.ROOT = /^\/(?![.[])/;
tokens.BINOP = /^(?:\+|-|\*|\/|%|==|!=|<=|>=|<|>|&&|\|\|)/;
tokens.UNOP = /^(?:\+|-|!)/;
tokens.DIGIT = /^[0-9]/;

tokens.ID = /^[a-zA-Z_][a-zA-Z0-9-_]*/;
tokens.NUMBER = /^[0-9]+(?:\.[0-9]+)?/;
tokens.CHARS = /^[^"{}\\]+/;

//  ---------------------------------------------------------------------------------------------------------------  //
//  Grammar rules
//  ---------------------------------------------------------------------------------------------------------------  //

var rules = {};

//  ---------------------------------------------------------------------------------------------------------------  //

//  expr := unary ( BIN_OP unary )*

rules.expr = function() {
    //  Here we have list of expressions (arguments) and operators.
    //  We need to group them according to operator's priorities.

    //  There are two stacks. One for operators:
    var ops = [];
    //  And one for arguments. There should be at least one argument so we parse it now:
    var args = [ this.parse('unary') ];
    this.skip();

    var op;
    //  Priority of operator on top of `ops`.
    //  In the beginning it's 0.
    var cp = 0;

    //  In the loop we do two operations:
    //
    //    * Shift: read one operator and one argument and put them in `ops` and `args`.
    //    * Reduce: pop all operators with priority greater or equal than given.
    //      For each operator pop two arguments, group them and push back to `args`.
    //
    //  For example: [ 'a', '*', 'b', '+', 'c' ].
    //
    //      args: [ 'a' ]               ops: []
    //      shift
    //      args: [ 'b', 'a' ]          ops: [ '*' ]
    //      reduce(5)
    //      args: [ '(a * b)' ]         ops: []
    //      shift
    //      args: [ 'c', '(a * b)' ]    ops: [ '+' ]
    //      reduce(0)
    //      args: [ '((a * b) + c)' ]   ops: []
    //
    while (( op = this.test('BINOP') )) {
        this.move(op.length);
        this.skip();

        var p = BINOPS[op];
        //  Next op has less or equal priority than top of `ops`.
        if (p <= cp) {
            //  Reduce.
            reduce(p);
        }
        //  Shift.
        ops.unshift(op);
        args.unshift( this.parse('unary') );
        this.skip();

        //  Update cp.
        cp = p;
    }
    //  Reduce all remaining operators.
    reduce(0);

    //  Result is on top of the `args`.
    return args[0];

    function reduce(p) {
        var op, left, right;
        //  If top of `ops` has greater or equal priority than `p` -- reduce it.
        while ( (( op = ops[0] )) && (BINOPS[op] >= p) ) {
            //  Pop two arguments.
            right = args.shift();
            left = args.shift();
            //  Push back result of `op`.
            args.unshift({
                _id: 'binop',
                //  Type of '+', '-', '*', '/', '%' is scalar. Boolean otherwise.
                _type: ('+-*/%'.indexOf(op) > -1) ? TYPE_SCALAR : TYPE_BOOL,
                //  If either of left or right is local, then binary expression is local too.
                _local: left._local || right._local,

                //  Do not forget to pop `op` out of `ops`.
                op: ops.shift(),
                left: left,
                right: right
            });
        }
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  unary := UNOP? unary | primary

rules.unary = function() {
    var op;
    if (( op = this.test('UNOP') )) {
        this.move();

        var expr = this.parse('unary');

        return {
            _id: 'unop',
            //  Type of '!' is boolean, '+' and '-' -- scalar.
            _type: (op === '!') ? TYPE_BOOL : TYPE_SCALAR,
            _local: expr._local,

            op: op,
            expr: expr
        };
    }

    return this.parse('primary');
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  primary := string | jpath | subexpr | number | filter | var

rules.primary = function() {
    var la = this.la();

    switch (la) {
        case '"':
            return this.parse('string');

        case '.':
        case '/':
            return this.parse('jpath');

        case '(':
            return this.parse('subexpr');
    }

    if ( this.test('DIGIT') ) {
        return {
            _id: 'number',
            _type: TYPE_SCALAR,

            value: this.match('NUMBER')
        };
    }

    var name = this.match('ID');

    if ( this.test('.') ) {
        return {
            _id: 'filter',
            _type: TYPE_NODESET,

            name: name,
            jpath: this.parse('jpath')
        };
    }

    if ( this.test('(') ) {
        this.move();
        this.skip();

        var args = [];
        if ( !this.test(')') ) {
            args.push( this.parse('expr') );
            this.skip();

            while ( this.test(',') ) {
                this.move();
                this.skip();
                args.push( this.parse('expr') );
                this.skip();
            }
        }

        this.match(')');

        return {
            _id: 'func',
            _type: TYPE_SCALAR,

            name: name,
            args: args
        };
    }

    return {
        _id: 'var',
        _type: TYPE_NODESET,

        name: name
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  subexpr := '(' expr ')'

rules.subexpr = function() {
    this.move();
    this.skip();
    var expr = this.parse('expr');
    this.skip();
    this.match(')');

    return {
        _id: 'subexpr',
        _type: expr._type,
        _local: expr._local,

        expr: expr
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  jpath := '.' | '/' | '/'? step+

rules.jpath = function() {

    if ( this.test('SELF') ) {
        this.move();

        return {
            _id: 'self',
            _type: TYPE_NODESET,
            _local: true
        };
    }

    if ( this.test('ROOT') ) {
        this.move();

        return {
            _id: 'root',
            _type: TYPE_NODESET
        };
    }

    var abs;
    if ( this.test('/') ) {
        this.move();
        abs = true;
    }

    var steps = [];
    while (1) {
        var la = this.la();

        if (la === '.') {
            steps.push( this.parse('step') );
        } else if (la === '[') {
            var pred = this.parse('pred');
            if (pred._id === 'guard') {
                steps.unshift(pred);
            } else {
                steps.push(pred);
            }
        } else {
            break;
        }
    }

    return {
        _id: 'jpath',
        _type: TYPE_NODESET,
        _local: !abs,

        abs: abs,
        steps: steps
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  step := '.' pred | '.*' | '.' ID

rules.step = function() {
    this.move();

    var la = this.la();

    if (la === '[') {
        return this.parse('pred');
    }

    if (la === '*') {
        this.move();

        return {
            _id: 'star'
        };
    }

    return {
        _id: 'nametest',

        nametest: this.match('ID')
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  pred := '[' expr ']'

rules.pred = function() {
    this.move();
    this.skip();
    var expr = this.parse('expr');
    this.skip();
    this.match(']');

    //  There are three types of "predicates":
    //
    //    * Predicate. `expr` is local (i.e. it depends on current context).
    //      Basically it means that it contains at least one non-absolute jpath.
    //
    //    * Global predicate (or guard). `expr` is not local but it has boolean type.
    //
    //    * Index. Global non-boolean expression.
    //
    var _id = 'index';
    if (expr._local) {
        _id = 'pred';
    } else if (expr._type === TYPE_BOOL) {
        _id = 'guard';
    }

    return {
        _id: _id,

        expr: expr
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

rules.string = function() {
    this.match('"');
    var content = this.parse('string_content');
    this.match('"');

    return content;
};

var disymbols = {
    '{{': '{',
    '}}': '}',
    '\\"': '"',
    '\\\\': '\\'
    //  FIXME: Нужны ли тут \', \n, \t и т.д.?
};

rules.string_content = function() {
    var parts = [];
    var c;
    var str = '';

    while (this.s) {
        c = disymbols[ this.la(2) ];
        if (c) {
            str += c;
            this.move(2);
        } else {
            c = this.la();

            if (c === '"') {
                break;
            }

            if (c === '\\') {
                str += c;
                this.move();
            } else if (c === '{') {
                pushStr();

                this.move();
                this.skip();
                parts.push( this.parse('expr') );
                this.skip();
                this.match('}');
            } else {
                str += this.match('CHARS');
            }
        }
    }
    pushStr();

    //  Это пустая строка.
    if (!parts.length) {
        parts.push( stringLiteral('') );
    }

    return {
        _id: 'string',
        _type: TYPE_SCALAR,

        value: parts
    };

    function pushStr() {
        if (str) {
            parts.push( stringLiteral(str) );
            str = '';
        }
    }

    function stringLiteral(s) {
        return {
            _id: 'string_literal',
            _type: TYPE_SCALAR,

            value: s
        };
    }
};


//  ---------------------------------------------------------------------------------------------------------------  //

var parser = new no.Parser(rules, tokens);

var _cache = {};

//  ---------------------------------------------------------------------------------------------------------------  //
//  no.jpath
//  ---------------------------------------------------------------------------------------------------------------  //

no.jpath = function(expr, data, vars, funcs) {
    return no.jpath.toScalar( no.jpath.expr(expr)(data, vars, funcs) );
};

no.jpath.raw = function(expr, data, vars, funcs) {
    return no.jpath.expr(expr)(data, vars, funcs);
};

no.jpath.scalar = function(expr) {
    var compiled = no.jpath.expr(expr);

    return function(data, vars, funcs) {
        return no.jpath.toScalar( compiled(data, vars, funcs) );
    };
};

no.jpath.boolean = function(expr) {
    var compiled = no.jpath.expr(expr);

    return function(data, vars, funcs) {
        return no.jpath.toBoolean( compiled(data, vars, funcs) );
    };
};

no.jpath.string = function(str) {
    return compileString(str, 'string_content');
};

//  Возвращает функцию с сигнатурой:
//
//      function(data, vars, funcs) { ... }
//
no.jpath.expr = function(expr) {
    var type = typeof expr;

    if (type === 'string') {
        return compileString(expr, 'expr');
    }

    //  Object or array.
    if (expr && type === 'object') {
        return ( Array.isArray(expr) ) ? compileArray(expr) : compileObject(expr);
    }

    //  Value.
    return function() {
        return expr;
    };
};

//  ---------------------------------------------------------------------------------------------------------------  //

no.jpath.toScalar = function(result) {
    if (result instanceof JNode) {
        return result.data;
    } else if (result instanceof JNodeset) {
        return ( result.isEmpty() ) ? undefined : result.toArray();
    } else {
        return result;
    }
};

no.jpath.toBoolean = function(result) {
    if (result instanceof JNode || result instanceof JNodeset) {
        return result.boolean();
    } else {
        return result;
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

function compileString(expr, id) {
    var key = expr + '::' + id;

    //  FIXME: Разложить по разным кэшам?
    var cached = _cache[key];

    if (!cached) {
        //  expr isn't cached.
        cached = _cache[key] = compile( parser.start(expr, id) );
    }

    return cached;
}

function compileObject(obj) {
    var items = {};

    for (var key in obj) {
        items[key] = no.jpath.expr( obj[key] );
    }

    //  FIXME: Компилировать сразу в функцию без цикла?
    return function(data, vars, funcs) {
        var r = {};

        for (var key in items) {
            r[key] = no.jpath.toScalar( items[key](data, vars, funcs) );
        }

        return r;
    };
}

function compileArray(arr) {
    var items = [];

    var l = arr.length;
    for (var i = 0; i < l; i++) {
        items.push( no.jpath.expr( arr[i] ) );
    }

    //  FIXME: Компилировать сразу в функцию без цикла?
    return function(data, vars, funcs) {
        var r = [];

        for (var i = 0; i < l; i++) {
            r.push( no.jpath.toScalar( items[i](data, vars, funcs) ) );
        }

        return r;
    };
}


//  ---------------------------------------------------------------------------------------------------------------  //
//  Compilation
//  ---------------------------------------------------------------------------------------------------------------  //

function compile(ast) {
    var exprs = [];

    var p = (ast._id === 'jpath') ? jpath2func(ast, exprs) : expr2func(ast, exprs);

    var r = '';
    for (var i = 0; i <= p; i++) {
        r += 'function t' + i + '(node, root, vars, funcs) {\n' + exprs[i] + '\n}\n\n';
    }
    r += 'return function(data, vars, funcs) {\nvar node = new no.JNode(data);\nreturn t' + p + '(node, node, vars, funcs);\n}\n';

    //  console.log(r);
    return Function('no', r)(no);
}

//  ---------------------------------------------------------------------------------------------------------------  //

function expr2func(ast, exprs) {
    var r = 'return (' + ast2js(ast, exprs) + ');';

    return exprs.push(r) - 1;
}


function jpath2func(ast, exprs) {
    var r = '';
    if (ast.abs) {
        //  If it's an absolute jpath, then we should use root instead of data.
        r += 'node = root;\n';
    }

    var steps = ast.steps;
    for (var i = 0, l = steps.length; i < l; i++) {
        var step = steps[i];

        var id = step._id;
        switch (id) {
            case 'nametest':
                r += 'node = node.nametest("' + step.nametest + '");\n';
                break;

            case 'star':
                r += 'node = node.startest();\n';
                break;

            case 'pred':
            case 'index':
                //  Cast `expr` to boolean or scalar.
                step.expr._as = (id === 'pred') ? TYPE_BOOL : TYPE_SCALAR;
                var p = expr2func(step.expr, exprs);
                r += 'node = node.' + id + '(t' + p + ', root, vars, funcs);\n';
                break;

            case 'guard':
                r += 'if (!(' + ast2js(step.expr, exprs) + ')) { return node.empty; }\n';
                break;
        }

        if (id !== 'guard') {
            r += 'if (node.isEmpty()) { return node.empty; }\n';
        }
    }

    r += 'return node;';

    return exprs.push(r) - 1;
}

//  ---------------------------------------------------------------------------------------------------------------  //

function ast2js(ast, exprs) {
    var js;

    switch (ast._id) {

        case 'root':
            js = 'root';
            break;

        case 'self':
            js = 'node';
            break;

        case 'number':
            js = ast.value;
            break;

        case 'string_literal':
            js = JSON.stringify(ast.value);
            break;

        case 'string':
            //  FIXME: Убрать map.
            js = '(' + ast.value.map(function(value) {
                value._as = TYPE_SCALAR;
                return ast2js(value, exprs);
            }).join(' + ') + ')';
            break;

        case 'var':
            js = '(new no.JNode(vars["' + ast.name + '"]))';
            break;

        case 'func':
            js = 'funcs["' + ast.name + '"](';
            for (var i = 0, l = ast.args.length; i < l; i++) {
                var arg = ast.args[i];
                arg._as = TYPE_SCALAR;
                js += (i) ? ',' : '';
                js += ast2js(arg, exprs);
            }
            js += ')';
            break;

        case 'unop':
            //  Cast expr to boolean ('!') or scalar ('+', '-').
            ast.expr._as = (ast.op === '!') ? TYPE_BOOL : TYPE_SCALAR;

            js = ast.op + '(' + ast2js(ast.expr, exprs) + ')';
            break;

        case 'binop':
            var l = ast.left;
            var r = ast.right;

            var lt = l._type;
            var rt = r._type;

            var op = ast.op;
            var as;
            switch (op) {
                case '&&':
                case '||':
                    if (lt === TYPE_BOOL && rt === TYPE_BOOL) {
                        //  (.foo > 42) || (.bar < 42)
                        //  Both operands should be boolean.
                        as = TYPE_BOOL;
                    } else {
                        //  .foo || 42
                        as = TYPE_SCALAR;
                    }
                    break;

                case '==':
                case '!=':
                    if ( lt !== rt && (lt === TYPE_BOOL || rt === TYPE_BOOL) ) {
                        //  We compare nodeset or scalar to boolean.
                        //  Both operands should be boolean then.
                        as = TYPE_BOOL;
                    }
                    break;

                default:
                    //  Both operands should be scalar.
                    as = TYPE_SCALAR;
            }
            if (as) {
                //  Cast both operands if `as`.
                l._as = r._as = as;
            }

            var ljs = ast2js(l, exprs);
            var rjs = ast2js(r, exprs);

            if (op === '==' || op === '!=') {
                //  Special case: compare nodeset to nodeset or scalar.
                if (lt === TYPE_NODESET || rt === TYPE_NODESET) {
                    //  (nodeset, nodeset) or (nodeset, scalar)
                    if (lt === TYPE_SCALAR) {
                        var t = rjs;
                        rjs = ljs;
                        ljs = t;
                    }

                    var type = (lt === rt) ? 'N' : 'S';
                    js = '(' + ljs + ').cmp' + type + '(' + rjs + ')';
                }
                if (js && op === '!=') {
                    js = '!(' + js + ')';
                }
            }

            if (js === undefined) {
                //  Usual binary operation.
                js = '(' + ljs + ' ' + ast.op + ' ' + rjs + ')';
            }

            break;

        case 'subexpr':
            js = '(' + ast2js(ast.expr, exprs) + ')';
            break;

        case 'jpath':
            var p = jpath2func(ast, exprs);
            js = 't' + p + '(node, root, vars, funcs)';
            break;

        case 'filter':
            var p = jpath2func(ast.jpath, exprs);
            js = 't' + p + '(new no.JNode(vars["' + ast.name + '"]), root, vars, funcs)';
            break;
    }

    //  Typecasting.
    if (ast._as && ast._as !== ast._type) {
        if (ast._type === TYPE_NODESET) {
            js = '(' + js + ').' + ast._as + '()';
        } else if (ast._type === TYPE_SCALAR) {
            js = '!!(' + js + ')';
        }
    }

    return js;
}

//  ---------------------------------------------------------------------------------------------------------------  //

var _setters = {};

no.jpath.set = function(jpath, data, value) {
    var compiled = _setters[jpath] || (( _setters[jpath] = compileSetter(jpath) ));

    return compiled(data, value);
};

function compileSetter(jpath) {
    //  В jpath строка вида '.foo.bar'.

    var parts = jpath.split('.');

    //  Первый элемент массива игнорируем (там пустая строка).
    var i = 1;
    //  Последний будем обрабатывать особо. После цикла.
    var l = parts.length - 1;

    var body = 'var r = data; var t;';
    for (; i < l; i++) {
        //  Делаем "шаг". Т.е. примерно `r = r['foo'];`.
        body += 't = r["' + parts[i] + '"];';
        //  Если после "шага" получился null или undefined, создаем на этом месте пустой объект.
        body += 'if (t == null) { t = r["' + parts[i] + '"] = {}; }';
        body += 'r = t;';
    }
    //  Последний шаг — присваиваем значение.
    body += 'r["' + parts[i] + '"] = value;';
    body += 'return data;';

    return new Function('data', 'value', body);
}

//  ---------------------------------------------------------------------------------------------------------------  //

})();

//  ---------------------------------------------------------------------------------------------------------------  //


/* ../node_modules/nommon/lib/no.jpath.js end */


    /* ../src/ns.js begin */
/**
 * noscript MVC framework
 * @namespace
 * @version 0.2.0
 * @tutotial entities
 */
var ns = {};

ns.VERSION = "0.8.8";

/**
 * Удобная функция для расстановки TODO, кидает исключение при вызове.
 */
ns.todo = function() {
    throw new Error('Unimplemented');
};

/**
 * Parse query string to object.
 * @param {string} s Query string
 * @returns {object}
 */
ns.parseQuery = function(s) {
    var o = {};

    s.split('&').forEach(function(chunk) {
        var p = chunk.split('=');
        var name = p.shift();
        if (name) {
            // В значении параметра может быть знак равенства
            var value = p.join('=');

            // &c=
            if (typeof value === 'undefined') {
                value = '';

            } else {
                try {
                    value = decodeURIComponent(value);
                } catch(e) {
                    value = '';
                    ns.log.info('ns.parseQuery.invalid-param', {
                        query: s,
                        chunk: chunk
                    });
                }
            }

            if (name in o) {
                // если параметры имеют вид ?id=1&id=2&id=3,
                // то на выходе должен получиться массив

                // если массива еще нет, то создаем его
                if (!Array.isArray(o[name])) {
                    o[name] = [ o[name] ];
                }

                o[name].push(value);
            } else {
                o[name] = value;
            }
        }
    });

    return o;
};

/**
 * Накладывает шаблон.
 * @param {*} json
 * @param {string} mode Модификатор.
 * @param {string} [module='main'] Название модуля.
 * @returns {string}
 */
ns.renderString = function(json, mode, module) {
    return yr.run(module || 'main', json, mode);
};

/**
 * Накладывает шаблон и возвращает полученную ноду.
 * @param {*} json Данные
 * @param {string} mode Модификатор.
 * @param {string} [module='main'] Название модуля.
 * @returns {?HTMLElement}
 */
ns.renderNode = function(json, mode, module) {
    var node = ns.html2node(ns.renderString(json, mode, module));
    return node ? node.firstChild : null;
};

/**
 * Производит первоначальную инициализацию noscript.
 */
ns.init = function() {
    ns.action.init();
    ns.router.init();
    ns.history.init();
    ns.initMainView();
};

/**
 * Инициализирует корневой View.
 */
ns.initMainView = function() {
    var mainView = ns.View.create('app');
    mainView._setNode(document.getElementById('app'));
    mainView.invalidate();

    /**
     * Корневой View.
     * @type {ns.View}
     */
    ns.MAIN_VIEW = mainView;
};

/**
 * Выполняет проверку, что первый аргумент истиннен.
 * Если это не так - кидает ошибку.
 * @param {?} truthy Любое значение, которое проверяется на истинность.
 * @param {string} contextName Контекст для быстрого поиска места возникновения ошибки.
 * @param {string} message Сообщение об ошибке.
 */
ns.assert = function(truthy, contextName, message) {
    /* jshint unused: false */
    if (!truthy) {
        ns.assert.fail.apply(this, Array.prototype.slice.call(arguments, 1));
    }
};

/**
 * Кидает ошибку с понятным сообщением.
 * @param {string} contextName Контекст для быстрого поиска места возникновения ошибки.
 * @param {string} message Сообщение об ошибке.
 */
ns.assert.fail = function(contextName, message) {
    var messageArgs = Array.prototype.slice.call(arguments, 2);
    for (var i = 0; i < messageArgs.length; i++) {
        message = message.replace('%s', messageArgs[i]);
    }
    throw new Error('[' + contextName + '] ' + message);
};

/**
 * Строит ключ по готовому объекту параметров.
 * @param {string} prefix Префикс ключа.
 * @param {object} params Объект с параметрами составляющими ключ.
 * @returns {string} Строка ключа.
 */
ns.key = function(prefix, params) {
    var key = prefix;
    params = params || {};
    for (var pName in params) {
        key += '&' + pName + '=' + encodeURIComponent(params[pName]);
    }
    return key;
};

/**
 * Конкатенирует параметры в GET-запрос
 * @param {object} params Параметры запроса
 * @returns {string}
 */
ns.params2query = function(params) {
    var query = [];

    var pName;
    var pValue;
    for (pName in params) {
        pValue = params[pName];
        if (Array.isArray(pValue)) {
            for (var i = 0; i < pValue.length; i++) {
                query.push(encodeURIComponent(pName) + '=' + encodeURIComponent(pValue[i]));
            }
        } else {
            query.push(encodeURIComponent(pName) + '=' + encodeURIComponent(pValue));
        }
    }

    return query.join('&');
};

/**
 * Clean internal data after tests
 */
ns.reset = function() {
    // в сборке для node.js его нет
    if (ns.action) {
        ns.action._reset();
    }
    ns.router._reset();
    ns.layout._reset();
    ns.Model._reset();
    ns.View._reset();
    ns.request._reset();
    ns.page._reset();
    ns.page.history.reset();

    ns.MAIN_VIEW = null;
};

/* ../src/ns.js end */

    /* ../src/ns.consts.js begin */
/**
 * Типы узлов ns.layout
 * @enum {string}
 */
ns.L = {};

ns.L.VIEW = 'view';
ns.L.ASYNC = 'async';
ns.L.BOX = 'box';

/**
 * Константы для ns.View.
 * @namespace
 */
ns.V = {};

/**
 * Статусы View.
 * @enum {string}
 */
ns.V.STATUS = {
    /**
     * Нет никакого кеша.
     */
    NONE: 'none',

    /**
     * Есть заглушка, данные для полноценного View загружаются.
     */
    LOADING: 'loading',

    /**
     * Есть кеш и он валиден.
     */
    OK: 'ok',

    /**
     * Есть кеш и он помечен невалидным, при следующем апдейте он должен перерисоваться.
     */
    INVALID: 'invalid'
};

/**
 * Константы для ns.Model.
 * @namespace
 */
ns.M = {};

/**
 * Статусы Model.
 * @enum {string}
 */
ns.M.STATUS = {
    /**
     * "Ошибка": данные загрузились с ошибкой.
     */
    ERROR: 'error',

    /**
     * "Инициализированна", данных нет.
     */
    INITED: 'inited',

    /**
     * "Создана", данных нет.
     */
    NONE: 'none',

    /**
     * "Все хорошо": данные загрузились успешно.
     */
    OK: 'ok',

    /**
     * "Невалидна": данные есть, но кто-то пометил их невалидными.
     */
    INVALID: 'invalid'
};

/**
 * Константы для ns.router.
 * @enum {string}
 */
ns.R = {

    /**
     * ID страницы, не относящейся к noscript приложению.
     */
    NOT_APP_URL: 'ns-router-not-app',

    /**
     * ID необъявленной/ненайденной страницы
     */
    NOT_FOUND: 'not-found',

    /**
     * ID страницы-редиректа.
     * Тут специально выбрано длинное название,
     * чтобы не пересечься с нормальными страницами.
     */
    REDIRECT: 'ns-router-redirect'
};

/**
 * Constants for ns.Updater.
 * @namespace
 */
ns.U = {};

/**
 * Statuses of ns.Updater.
 * @enum {string}
 */
ns.U.STATUS = {
    /**
     * Updater failed because of models request
     */
    'MODELS': 'models',

    /**
     * Updater failed because it expired (new Updater is running)
     */
    'EXPIRED': 'expired'
};

/**
 * Execution statuses of ns.Updater.
 * @enum {string}
 */
ns.U.EXEC = {
    'GLOBAL': 'global',
    'ASYNC': 'async',
    'PARALLEL': 'parallel'
};

ns.DEBUG = false;

/**
 * Параметры по умолчанию для http-запросов.
 * @type {object}
 */
ns.H = {
    DEFAULTS: {
        dataType: 'json',
        type: 'POST'
    }
};

/* ../src/ns.consts.js end */

    /* ../src/ns.consts.events.js begin */
/**
 * Хеш событий для удобного биндинга touch/desktop
 * @type {object}
 */
ns.V.EVENTS = {
    'click': 'click',
    'dblclick': 'dblclick',
    'mousedown': 'mousedown',
    'mousemove': 'mousemove',
    'mouseup': 'mouseup'
};

/**
 * Список DOM-событий.
 * @type {Array}
 * @constant
 */
ns.V.DOM_EVENTS = [
    'blur',
    'change',
    'input',
    'click',
    'dblclick',
    'dragstart',
    'dragenter',
    'dragover',
    'dragleave',
    'drag',
    'drop',
    'dragend',
    'focus',
    'focusin',
    'focusout',
    'keydown',
    'keypress',
    'keyup',
    'mousedown',
    'mouseenter',
    'mouseleave',
    'mousemove',
    'mouseout',
    'mouseover',
    'mouseup',
    'resize',
    'scroll',
    'submit'
];

/**
 * Список внутренних Noscript-событий.
 * @type {Array}
 * @constant
 */
ns.V.NS_EVENTS = [
    'ns-view-async',
    'ns-view-destroyed',
    'ns-view-init',
    'ns-view-htmlinit',
    'ns-view-show',
    'ns-view-touch',
    'ns-view-hide',
    'ns-view-htmldestroy'
];

/* ../src/ns.consts.events.js end */

    /* ../src/ns.consts.client.js begin */
/**
 * @const
 * @type {Boolean}
 */
ns.IS_TOUCH = (function() {
    // даем возможность определять IS_TOUCH приложению
    if (typeof window['NS_IS_TOUCH'] === 'boolean') {
        return window['NS_IS_TOUCH'];
    } else {
        return Boolean(
            'ontouchstart' in window ||
            (window.DocumentTouch && document instanceof DocumentTouch)
        );
    }
})();

//TODO: Pointer events support (MSIE 10)

// @see http://sitr.us/2011/07/28/how-mobile-safari-emulates-mouse-events.html
// @see http://developer.apple.com/library/safari/#documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
if (ns.IS_TOUCH) {
    ns.V.DOM_EVENTS.push(
        'swipe',
        'swipeleft',
        'swiperight',
        'tap',
        'touchstart',
        'touchmove',
        'touchend'
    );
    ns.V.EVENTS = {
        'click': 'tap',
        'dblclick': 'doubletap',
        'mousedown': 'touchstart',
        'mousemove': 'touchmove',
        'mouseup': 'touchend'
    };

}

/* ../src/ns.consts.client.js end */

    /* ../src/ns.dom.js begin */
(function(ns) {

    /**
     * Replaces oldNode with newNode
     * @param {Element} oldNode
     * @param {Element} newNode
     * @returns {boolean}
     */
    ns.replaceNode = function(oldNode, newNode) {
        // такая вот защита от лишних действий
        if (oldNode === newNode) {
            return true;
        }

        // если oldNode детачена из DOM, то у нее нет родителя
        if (oldNode.parentNode) {
            oldNode.parentNode.replaceChild(newNode, oldNode);
            return true;
        }

        return false;
    };

    /**
     * Removes node from DOM
     * @param {Element} node
     */
    ns.removeNode = function(node) {
        var parent = node.parentNode;
        if (parent) {
            parent.removeChild(node);
        }
    };

    /**
     * Returns DOM node with children generated from HTML-string.
     * @param {string} html
     * @returns {?HTMLElement}
     */
    ns.html2node = function(html) {
        if (!html) {
            return null;
        }

        var div = document.createElement('div');
        div.innerHTML = html;

        return div;
    };

    /**
     * Возвращает итератор детям ноды.
     * @param {HTMLElement} node Нода-контейнер.
     * @returns {{getNext: function}}
     */
    ns.childrenIterator = function(node) {
        // Итератор по HTMLCollection, который возвращает видимые ноды видов.
        return (function(children) {
            var position = -1;
            return {
                getNext: function() {
                    position++;
                    return children[position] || null;
                }
            };
        })(node.children);
    };

    var whiteSpacesInClassNameRE = /[\t\r\n]/g;

    /**
     * Checks if node has specified class.
     * @param {Element} node
     * @param {string} className
     * @returns {boolean}
     */
    if ((typeof document !== 'undefined') && document.createElement('div').classList) {

        ns.hasClass = function(node, className) {
            return node.classList.contains(className);
        };

    } else {

        ns.hasClass = function(node, className) {
            className = ' ' + className + ' ';
            return (node.nodeType === 1 && (' ' + node.className + ' ').replace(whiteSpacesInClassNameRE, ' ').indexOf(className) >= 0);
        };

    }

    /**
     * Полифил getElementsByClassName для IE8.
     * @function
     * @name ns.byClass
     * @param {string} className
     * @param {Element} context
     * @returns {Node[]}
     */
    if ((typeof document !== 'undefined') && document.getElementsByClassName) {

        ns.byClass = function(className, context) {
            context = context || document;
            return context.getElementsByClassName(className);
        };

    } else {

        ns.byClass = function(className, context) {
            context = context || document;
            return $(context).find('.' + className);
        };

    }

})(ns);

/* ../src/ns.dom.js end */

    /* ../src/ns.entityify.js begin */
(function(ns) {

    // @see http://jsperf.com/entityify-test

    var ENTITYIFY_REGEXP = /[&<>"'\/]/g;
    var ENTITYIFY_REPLACER = (function() {
        // @see https://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat_Sheet#Output_Encoding_Rules_Summary
        var chars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        return function(c) {
            return chars[c];
        };
    })();

    /**
     * Преобразует специальные символы в HTML сущности.
     * @param {string} s Строка
     * @returns {string}
     */
    ns.entityify = function(s) {
        return String(s).replace(ENTITYIFY_REGEXP, ENTITYIFY_REPLACER);
    };

    /**
     * Регулярка для поиска html-entity.
     * @type {RegExp}
     */
    var DEENTITYIFY_REGEXP = /&([^&;]+);/g;
    var DEENTITYIFY_REPLACER = (function() {
        var chars = {
            'amp':  '&',
            'lt':   '<',
            'gt':   '>',
            'quot': '"',
            '#x27': "'",
            '#x2F': "/"
        };
        return function(a, b) {
            return chars[b] || a;
        };
    })();

    /**
     * Преобразует HTML-сущности в символы.
     * @param {string} s Строка
     * @returns {string}
     */
    ns.deentityify = function(s) {
        return String(s).replace(DEENTITYIFY_REGEXP, DEENTITYIFY_REPLACER);
    };

})(ns);

/* ../src/ns.entityify.js end */

    /* ../src/ns.events.js begin */
/**
 * Миксин, реализующий простейший pub/sub
 * @mixin
 * @example
 * var foo = {};
 * no.extend(foo, ns.Events);
 * foo.on('bar', function(e, data) {
 *   console.log(e, data);
 * });
 * foo.trigger('bar', 42);
 */
ns.Events = {};

/**
 * Подписывает обработчик handler на событие name.
 * @param {string} name Название события.
 * @param {function} handler Обработчик события.
 * @returns {ns.Events}
 */
ns.Events.on = function(name, handler) {
    var handlers = this._nsevents_handlers || (( this._nsevents_handlers = {} ));

    ns.assert(typeof handler === 'function', 'ns.Events', 'Handler for event "%s" in not a function.', name);

    ( handlers[name] || (( handlers[name] = [] )) ).push(handler);

    return this;
};

/**
 * Подписывает обработчик handler на событие name, который испольняется только один раз.
 * @param {string} name Название события.
 * @param {function} handler Обработчик события.
 * @returns {ns.Events}
 */
ns.Events.once = function(name, handler) {
    var that = this;
    var once = function() {
        that.off( name, once );
        handler.apply(this, arguments);
    };
    once.__original = handler;
    this.on(name, once);
    return this;
};

/**
 * Отписывает обработчик handler от события name.
 * Если не передать handler, то удалятся вообще все обработчики события name.
 * @param {string} name Название события.
 * @param {function} [handler] Обработчик события.
 * @returns {ns.Events}
 */
ns.Events.off = function(name, handler) {
    var handlers;
    if (handler) {
        handlers = this._nsevents_handlers && this._nsevents_handlers[name];
        if (handlers) {
            //  Ищем этот хэндлер среди уже забинженных обработчиков этого события.
            for (var i = 0, l = handlers.length; i < l; i++) {
                if (handlers[i] === handler || handlers[i].__original === handler) {
                    //  Нашли и удаляем этот обработчик.
                    handlers.splice(i, 1);
                    break;
                }
            }
        }
    } else {
        handlers = this._nsevents_handlers;
        if (handlers) {
            //  Удаляем всех обработчиков этого события.
            handlers[name] = null;
        }
    }

    return this;
};

/**
 * "Генерим" событие name. Т.е. вызываем по-очереди (в порядке подписки) все обработчики события name.
 * В каждый передаем name и params.
 * @param {string} name
 * @param {...*} params
 * @returns {ns.Events}
 */
ns.Events.trigger = function(name, params) {
    /* jshint unused: false */
    var handlers = this._nsevents_handlers && this._nsevents_handlers[name];

    if (handlers) {
        //  Копируем список хэндлеров.
        //  Если вдруг внутри какого-то обработчика будет вызван `off()`,
        //  то мы не потеряем вызов следующего обработчика.
        handlers = handlers.slice();

        for (var i = 0, l = handlers.length; i < l; i++) {
            // оборачиваем обработчики в try-catch, чтобы не ломать очередь
            try {
                handlers[i].apply(this, arguments);
            } catch(e) {
                ns.log.exception('ns.events', e, {name: name});
            }
        }
    }

    return this;
};

/**
 * "Генерим" событие в следующем тике.
 * @see ns.Events.trigger
 * @param {string} event
 * @param {...*} params
 */
ns.Events.atrigger = function(event, params) {
    /* jshint unused: false */
    var that = this;
    var args = arguments;
    no.next(function() {
        that.trigger.apply(that, args);
    });
};

/**
 * "Форвардим" все сообщения name в другой объект.
 * @param {string} name
 * @param {object} object
 * @returns {ns.Events}
 */
ns.Events.forward = function(name, object) {
    return this.on(name, function(e, params) {
        object.trigger(e, params);
    });
};

/**
 * Global events bus.
 * @mixes ns.Events
 */
ns.events = no.extend( {}, ns.Events );

/* ../src/ns.events.js end */

    /* ../src/ns.history.js begin */
(function() {

    /**
     * Объект для работы с историей и адресной строкой браузера.
     * @namespace
     * @tutorial ns.history
     */
    ns.history = {};

    /**
     * Ицициализирует обработчики события popstate/hashchange и кликов по ссылкам (<a href=""/>).
     */
    ns.history.init = function() {
        $(window).on('popstate', function(e) {
            // прибиваем событие, чтобы не дергалась адресная строка
            e.preventDefault();
            e.stopPropagation();

            ns.history.onpopstate(e);
        });

        $(document).on(ns.V.EVENTS.click, 'a', ns.history._onAnchorClick);
    };

    /**
     * Добавляет урл в историю браузера.
     * @param {string} url
     * @param {string} [title]
     */
    ns.history.pushState = function(url, title) {
        if (isFunction(window.history.pushState)) {
            window.history.pushState(null, title || ns.page.title(url), url);
        }
    };

    /**
     * Заменяет урл в истории браузера.
     * @param {string} url
     * @param {string} [title]
     */
    ns.history.replaceState = function(url, title) {
        if (isFunction(window.history.replaceState)) {
            window.history.replaceState(null, title || ns.page.title(url), url);
        }
    };

    /**
     * Метод реакции на изменение адреса.
     */
    ns.history.onpopstate = function() {
        ns.page.go('', true);
    };

    /**
     * Метод перехода на ссылке из <a>.
     * @description Приложение может модифицифровать этот метод,
     * чтобы реализовать собственную логику.
     *
     * @param {string} href
     * @param {HTMLElement} target
     * @returns {Vow.Promise}
     */
    ns.history.followAnchorHref = function(href, target) {
        /* jshint unused: false */
        return ns.page.go(href);
    };

    /**
     * Обработчик кликов на <a>.
     * @description Не обрабатываются следующие клики:
     *  - если клик был с нажатым alt/ctrl/meta/shift
     *  - если hostname у ссылки отличается от текущего hostname
     *  - если у ссылки нет href
     *  - если у ссылки есть target="_blank"
     * @param {Event} e
     * @private
     */
    ns.history._onAnchorClick = function(e) {
        var target = e.currentTarget;

        // Чтобы работал Cmd/Ctrl/Shift + click на ссылках (открыть в новом табе/окне).
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
            return true;
        }

        // не обрабатываем переход по ссылке
        // если у ссылки нет протокола (случай href="javascript:void(0)")
        // NOTE: В ИЕ11 ссылки созданные через document.createElement не имеют protocol,
        // поэтому дополнительно необходимо проверить, что он вообще есть
        if (target.protocol && !/^https?:/.test(target.protocol)) {
            return true;
        }

        // не обрабываем переход по ссылке:
        // - если это внешняя ссылка
        // - если hostname пустой (IE11 для относительных ссылок)
        if (target.hostname && target.hostname !== window.location.hostname) {
            return true;
        }

        // если ссылка ведет в другой baseDir, то она внешняя и ее обрабатывать не надо
        if (ns.router.baseDir) {
            var linkPath = target.pathname;
            var baseDir = ns.router.baseDir;
            if (linkPath.substr(0, baseDir.length) !== baseDir) {
                return true;
            }
        }

        var href = target.getAttribute('href');

        if (!href || target.getAttribute('target')) {
            return true;
        }

        var returnValue = ns.history.followAnchorHref(href, target);
        // если вернули Promise, то ссылка была обработана и
        // надо сделать preventDefault
        if (Vow.isPromise(returnValue)) {
            e.preventDefault();
            return true;
        }
    };

    /**
     * Проверяет, является ли переданный объект функцией.
     * @param  {Function} fn
     * @returns {Boolean}
     */
    function isFunction(fn) {
        return 'function' === typeof fn;
    }

})();

/* ../src/ns.history.js end */

    /* ../src/ns.http.client.js begin */
/**
 * Creates and executes ajax request (a POST request with json return data type by default).
 * @param {string} url
 * @param {object} params Request parameters.
 * @param {object=} options Standart jQuery.ajax settings object.
 * @returns {Vow.Promise}
 */
ns.http = function(url, params, options) {
    // в пустой объект записывать дефолты, затем передданные опции
    options = no.extend({}, ns.H.DEFAULTS, options);
    options.url = url;
    options.data = params;

    var promise = new Vow.Promise();
    $.ajax(options)
        .done(function(data) {
            promise.fulfill(data);
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            var error = errorThrown || textStatus || 'unknown error';
            promise.reject({
                error: error,
                xhr: jqXHR
            });
        });

    return promise;
};

/* ../src/ns.http.client.js end */

    /* ../src/ns.object.js begin */
/**
 * Хелперы для работы с объектами
 * @namespace
 */
ns.object = {};

/**
 * Клонирует объект.
 * @param {object} obj Объект для клонирования.
 * @returns {object}
 */
ns.object.clone = function(obj) {
    if (obj && typeof obj === 'object') {
        var r;

        if ( Array.isArray(obj) ) {
            r = [];
            for (var i = 0; i < obj.length; i++) {
                r.push( ns.object.clone( obj[i] ) );
            }
        } else {
            r = {};
            for (var key in obj) {
                r[key] = ns.object.clone( obj[key] );
            }
        }

        return r;
    }

    return obj;
};

/**
 * Определяет, пустой ли объект или нет.
 * @param {object} obj Тестируемый объект.
 * @returns {boolean}
 */
ns.object.isEmpty = function(obj) {
    /* jshint unused: false */
    for (var key in obj) {
        return false;
    }

    return true;
};

/* ../src/ns.object.js end */

    /* ../src/ns.profile.js begin */
(function() {

    /**
     * Профилировщик.
     * @mixin
     * @description
     * Этот mixin надо подмешивать в прототип класса.
     * ```js
     * no.extend(ns.Update.prototype, no.profile);
     * ```
     */
    ns.profile = {};

    /**
     * Ставит начальную точку отчета для метрики.
     * @param {string} label Название метрики.
     */
    ns.profile.startTimer = function(label) {
        if (!this._profileTimes) {
            this._profileTimes = {};
        }

        // проверяем, что таймер пустой
        ns.assert(!this._profileTimes[label], 'ns.profile', "Timer '%s' is in use", label);
        this._profileTimes[label] = Date.now();
    };

    /**
     * Ставит конечную точку отчета для метрики.
     * @param {string} label Название метрики.
     * @returns {number} Рассчитанное значение метрики.
     */
    ns.profile.stopTimer = function(label) {
        if (!this._profileTimes) {
            this._profileTimes = {};
        }

        // проверяем, что таймер непустой
        ns.assert(this._profileTimes[label], 'ns.profile', "Timer '%s' haven't been started", label);
        this._profileTimes[label] = Date.now() - this._profileTimes[label];

        return this._profileTimes[label];
    };

    /**
     * Останавливает отсчёт метрики from и начинает отсчёт метрики to
     * @param {string} from Название останавливаемой метрики
     * @param {string} to Название запускаемой метрики
     */
    ns.profile.switchTimer = function(from, to) {
        this.stopTimer(from);
        this.startTimer(to);
    };

    /**
     * Возвращает значение метрики.
     * @param {string} label Название метрики.
     * @returns {number}
     */
    ns.profile.getTimer = function(label) {
        if (!this._profileTimes) {
            this._profileTimes = {};
        }
        // проверяем typeof, чтобы возвращать 0
        var value = this._profileTimes[label];
        return typeof value === 'number' ? value : NaN;
    };

    /**
     * Возвращает все значения метрики
     * @returns {object}
     */
    ns.profile.getTimers = function() {
        return no.extend({}, this._profileTimes);
    };

})();

/* ../src/ns.profile.js end */


    /* ../src/ns.action.js begin */
(function(ns, undefined) {

    /**
     * Объект, реализующий экшены.
     * @namespace
     */
    ns.action = {};

    var _actions = {};

    /**
     * Флаг инициализации событий.
     * @type {Boolean}
     * @private
     */
    var _inited = false;

    /**
     * Register action.
     * @param {string} id Action id.
     * @param {function} action Action to be performed.
     */
    ns.action.define = function(id, action) {
        if (id in _actions) {
            throw new Error("[ns.action] Can't redefine '" + id + "'");
        }
        _actions[id] = action;
    };

    /**
     * Copy action with different name.
     * @param {string} existentAction Action id.
     * @param {string} newAction Action id.
     */
    ns.action.copy = function(existentAction, newAction) {
        if (newAction in _actions) {
            throw new Error("[ns.action] Can't redefine '" + newAction + "'");
        }
        if (!(existentAction in _actions)) {
            throw new Error("[ns.action] '" + existentAction + "' is not defined");
        }
        _actions[newAction] = _actions[existentAction];
    };

    /**
     * Run action by name
     * @param {string} id Action name
     * @param {object} [params] Params
     * @param {Element} [node]
     * @param {Event} [event]
     * @returns {*}
     * @throws Бросает исключение, если action не определен
     */
    ns.action.run = function(id, params, node, event) {
        var action = _actions[id];
        ns.assert(action, 'ns.action', '%s is not defined', id);

        try {
            return action(id, params, node, event);
        } catch(e) {
            ns.log.exception('ns.action', e);
        }
    };

    /**
     * Получает параметры экшена из ноды
     * @param {HTMLElement} node
     * @returns {object}
     */
    ns.action.getParams = function(node) {
        var paramString = node.getAttribute('data-params');
        if (paramString && paramString.charAt(0) === '{') {
            try {
                return JSON.parse(paramString);
            } catch(e) {}
        }

        //TODO: parseURL?
        return {};
    };

    /**
     * Инициализует механизм экшенов (навешивает обработчики событий).
     */
    ns.action.init = function() {
        if (_inited) {
            return;
        }

        _inited = true;

        var $body = $('body');
        var selector = '.ns-action';
        var events = [
            ns.V.EVENTS.click,
            ns.V.EVENTS.dblclick
        ].join(' ');

        $body.on(events, selector, this._process);
    };

    /**
     * Process "click" event
     * @param {Event} e
     * @returns {boolean}
     * @private
     */
    ns.action._process = function(e) {
        var target = e.currentTarget;
        var action = (e.type === 'dblclick') ? target.getAttribute('data-dblclick-action') : target.getAttribute('data-click-action');
        var returnValue = true;

        // если есть action
        if (action) {
            returnValue = ns.action.run(action, ns.action.getParams(target), target, e);
        }

        return (returnValue === undefined || Vow.isPromise(returnValue)) ? false : returnValue;
    };

    ns.action._reset = function() {
        _actions = {};
    };

})(ns);

/* ../src/ns.action.js end */

    /* ../src/ns.model.js begin */
(function() {

    /**
     * @classdesc Базовый класс для моделей. Конструктор пустой, чтобы легче было наследоваться.
     * Вся инициализация делается в _init(), который вызывает фабрикой ns.Model.get().
     * @constructor
     * @mixes ns.Events
     * @tutorial ns.model
     * @fires ns.Model#ns-model-init
     */
    ns.Model = function() {};

    //  Добавляем методы из ns.Events: on(), off(), trigger().
    no.extend(ns.Model.prototype, ns.Events);

    var _ctors = {};
    var _infos = {};

    var _cache = {};

    var _keySuffix = 0;

    /**
     * @type {ns.M.STATUS}
     * @private
     */
    ns.Model.prototype.STATUS = ns.M.STATUS;

    ns.Model.prototype.RETRY_LIMIT = 3;

    /**
     * Состояние модели.
     * @type {ns.M.STATUS}
     * @private
     */
    ns.Model.prototype.status = ns.M.STATUS.NONE;

    /**
     * Уникальный ключ модели.
     * @type {string}
     */
    ns.Model.prototype.key = null;

    /**
     * Параметры модели.
     * @type {object}
     */
    ns.Model.prototype.params = null;

    /**
     * Промис исправления ошибки запроса.
     * @type {Vow.Promise}
     * @private
     */
    ns.Model.prototype._errorFixingPromise = null;

    /**
     *
     * @param {string} id
     * @param {object} params
     * @private
     */
    ns.Model.prototype._init = function(id, params) {
        this.id = id;

        this._reset();

        this.info = ns.Model.info(id);
        no.extend(this, ns.Model.getKeyAndParams(id, params, this.info));

        this._reinit();
    };

    /**
     * Переинициализирует модель после #destroy() или самой первой инициализации.
     * @private
     */
    ns.Model.prototype._reinit = function() {
        if (this.status === this.STATUS.NONE) {
            this._bindEvents();
            this.status = this.STATUS.INITED;
            /**
             * Модель создана и проинициализованна.
             * @event ns.Model#ns-model-init
             */
            this.trigger('ns-model-init');
        }
    };

    /**
     * Сбрасывает состояние модели.
     * @param {ns.M.STATUS} [status=ns.M.STATUS.NONE]
     * @private
     */
    ns.Model.prototype._reset = function(status) {
        this.data = null;
        this.error = null;

        this._softReset(status);

        /**
         * Data version.
         * @type {number}
         * @protected
         */
        this._version = 0;
    };

    /**
     * Магкий сброс. Устанавливает только статус и сбрасывает retries.
     * Не удаляет данные и не сбрасывает версию.
     * @param {ns.M.STATUS} [status=ns.M.STATUS.NONE]
     * @private
     */
    ns.Model.prototype._softReset = function(status) {
        this.status = status || this.STATUS.NONE;
        this.retries = 0;
    };

    /**
     * Регистрирует обработчики событий.
     * @private
     */
    ns.Model.prototype._bindEvents = function() {
        for (var event in this.info.events) {
            var callbacks = this.info.events[event];
            // приводим обработчики к массиву
            if (!Array.isArray(callbacks)) {
                callbacks = [callbacks];
            }

            for (var i = 0, j = callbacks.length; i < j; i++) {
                this.on(event, this._prepareCallback(callbacks[i]));
            }
        }
    };

    /**
     * Убирает обработчики событий.
     * @private
     */
    ns.Model.prototype._unbindEvents = function() {
        for (var event in this.info.events) {
            var callbacks = this.info.events[event];
            // приводим обработчики к массиву
            if (!Array.isArray(callbacks)) {
                callbacks = [callbacks];
            }

            for (var i = 0, j = callbacks.length; i < j; i++) {
                this.off(event, this._prepareCallback(callbacks[i]));
            }
        }
    };

    /**
     * Ищет метод в объекте по имени или возвращает переданную функцию
     * Нужен для навешивания коллбеков
     * @param {String | Function} method
     * @returns {Function}
     * @private
     */
    ns.Model.prototype._prepareCallback = function(method) {
        if (typeof method === 'string') {
            method = this[method];
        }

        ns.assert((typeof method === 'function'), 'ns.Model', "Can't find method '%s' in '%s' to bind event", method, this.id);

        return method;
    };

    /**
     * Инвалидирует модель.
     */
    ns.Model.prototype.invalidate = function() {
        this._softReset(this.STATUS.INVALID);
    };

    /**
     * Уничтожает модель.
     * @fires ns.Model#ns-model-before-destroyed
     * @fires ns.Model#ns-model-destroyed
     */
    ns.Model.prototype.destroy = function() {
        /**
         * @events ns.Model#ns-model-before-destroyed
         */
        this.trigger('ns-model-before-destroyed');

        this._reset(this.STATUS.NONE);
        /**
         * Сообщает об уничтожении модели
         * @events ns.Model#ns-model-destroyed
         */
        this.trigger('ns-model-destroyed');
        this._unbindEvents();
    };

    /**
     *
     * @returns {boolean}
     */
    ns.Model.prototype.isValid = function() {
        return (this.status === this.STATUS.OK);
    };

    /**
     *
     * @returns {null|*}
     */
    ns.Model.prototype.getData = function() {
        return this.data;
    };

    /**
     * Returns data matched by jpath.
     * @param {string} jpath
     * @returns {*}
     * @example
     * var foo = model.get('.foo'); // model.data.foo.
     * var bar = model.get('.foo.bar'); // model.data.foo.bar (если foo существует).
     */
    ns.Model.prototype.get = function(jpath) {
        var data = this.data;
        if (data) {
            return no.jpath(jpath, data);
        }
    };

    /**
     * Returns data matched by jpath.
     * This methods always returns array of results.
     * @param {string} jpath
     * @returns {array}
     */
    ns.Model.prototype.select = function(jpath) {
        var data = this.data;
        if (data) {
            return no.jpath.raw(jpath, data).toArray();
        }
        return [];
    };

    /**
     * Сохраняет value по пути jpath.
     * @param {string} jpath jpath до значения.
     * @param {*} value Новое значение.
     * @param {ns.Model~setOptions} [options] Флаги.
     * @fires ns.Model#ns-model-changed
     */
    ns.Model.prototype.set = function(jpath, value, options) {
        var data = this.data;
        if ( !this.isValid() || !data ) {
            return;
        }

        //  FIXME: Непонятно, нужно ли сравнивать старое и новое значение.
        //  Как бы нужно, но это довольно дорого и сложно.
        //  Пока что будет версия без сравнения.

        no.jpath.set(jpath, data, value);

        options = options || {};
        options.jpath = jpath;
        this.touch(options);

        if (options.silent) {
            return;
        }

        //  Кидаем сообщения о том, что изменились части модели.
        //  Например, если jpath был '.foo.bar', то кидаем два сообщения: 'ns-model-changed.foo.bar' и 'ns-model-changed.foo'.
        //  В качестве параметра подjpath и полный jpath, по которому менялись данные.

        var parts = jpath.split('.');
        var l = parts.length;
        while (l > 1) {
            var _jpath = parts.slice(0, l).join('.');

            //  TODO передавать старое значение и новое

            this.trigger('ns-model-changed' + _jpath, _jpath, jpath);
            l--;
        }
    };

    /**
     * Устанавливает новые данные модели.
     * @param {*} data Новые данные.
     * @param {ns.Model~setOptions} [options] Флаги.
     * @returns {ns.Model}
     * @fires ns.Model#ns-model-changed
     */
    ns.Model.prototype.setData = function(data, options) {
        // переинициализация после #destroy()
        this._reinit();

        if (data && (!this.isValid() || this.hasDataChanged(data))) {

            /**
             * Данные модели.
             * @description
             * Это свойство нельзя использовать напрямую,
             * т.к. там могут быть неактуальные или неправильные данные
             * @private
             * @type {*}
             */
            this.data = this._beforeSetData(this.preprocessData(data), options);

            this.status = this.STATUS.OK;
            this.error = null;

            this.touch(options);
        }

        return this;
    };

    /**
     *
     * @param {*} data
     * @returns {boolean}
     */
    ns.Model.prototype.hasDataChanged = function(data) {
        return !!data;
    };

    /**
     *
     * @returns {*}
     */
    ns.Model.prototype.getError = function() {
        return this.error;
    };

    /**
     *
     * @param {*} error
     */
    ns.Model.prototype.setError = function(error) {
        if (this.isErrorCanBeFixed(error)) {
            this._errorFixingPromise = this.fixError(error);

        } else {
            this.data = null;
            this.error = error;
            this.status = this.STATUS.ERROR;
        }
    };

    /**
     * Возвращает true, если модель способна исправить эту ошибку.
     * @description
     * Этот метод нужно переопределить, если модель имеет возможность исправлять ошибки.
     * Например, запросы подписываеются временным token.
     * Если токен протух, то модель прозрачно может его перезапросить и сделать перезапрос себя.
     * @see fixError
     * @abstract
     * @param {*} error
     */
    ns.Model.prototype.isErrorCanBeFixed = function(error) {
        /* jshint unused: false */
        return false;
    };

    /**
     * Возвращает Promise, который должен исправить ошибку и после которого модель можно перезапросить
     * @see isErrorCanBeFixed
     * @abstract
     * @param {*} error
     * @returns {Vow.Promise}
     */
    ns.Model.prototype.fixError = function(error) {
        /* jshint unused: false */
        return Vow.resolve();
    };

    /**
     * @param {*} data Новые данные.
     * @param {ns.Model~setOptions} [options] Флаги.
     * @returns {*}
     * @private
     */
    ns.Model.prototype._beforeSetData = function(data, options) {
        /* jshint unused: false */
        return data;
    };

    /**
     *
     * @param {*} data
     * @returns {*}
     */
    ns.Model.prototype.preprocessData = function(data) {
        return data;
    };

    /**
     *
     * @returns {object}
     */
    ns.Model.prototype.getRequestParams = function() {
        return ns.Model._getKeyParams(this.id, this.params, this.info);
    };

    /**
     * Возвращает, можно ли запрашивать / перезапрашивать модель:
     * - публичный canRequest разрешает перезапрос
     * - do-модели нельзя перезапрашивать
     * - модель была перезапрошена не более RETRY_LIMIT раз
     * @returns {boolean}
     */
    ns.Model.prototype._canRequest = function() {
        return this.canRequest() && (!this.retries || !this.isDo()) && this.retries < this.RETRY_LIMIT;
    };

    /**
     * Позволяет пользователю расширить
     * проверку на возможность запроса модели
     * @return {boolean}
     */
    ns.Model.prototype.canRequest = no.true;

    /**
     *
     * @param {*} result
     * @returns {*}
     */
    ns.Model.prototype.extractData = function(result) {
        if (result) {
            return result.data;
        }
    };

    /**
     *
     * @param {*} result
     * @returns {*}
     */
    ns.Model.prototype.extractError = function(result) {
        if (result) {
            return result.error;
        }
    };

    /**
     *
     * @returns {boolean}
     */
    ns.Model.prototype.isDo = function() {
        return this.info.isDo;
    };

    /**
     * Returns data version.
     * @returns {number}
     */
    ns.Model.prototype.getVersion = function() {
        return this._version;
    };

    ns.Model.prototype._incVersion = function() {
        this._version++;
    };

    /**
     * Инкрементирует версию модели.
     * @fires ns.Model#ns-model-touched
     * @fires ns.Model#ns-model-changed
     */
    ns.Model.prototype.touch = function(options) {
        options = options || {};

        if (options.silent) {
            return;
        }

        this._incVersion();

        /**
         * Событие сообщает об инкрементации версии модели.
         * @event ns.Model#ns-model-touched
         */
        this.trigger('ns-model-touched');

        var jpath = options.jpath || '';

        /**
         * Сообщение о том, что модель изменилась.
         * @event ns.Model#ns-model-changed
         * @param {string} evt Название события
         * @params {string} jpath JPath, по которому изменились данные. Если пустой, то изменилась вся модель.
         */
        this.trigger('ns-model-changed', jpath);
    };

    /**
     * Подготавливает модель к запросу.
     * @param {number} requestID ID запроса.
     * @returns {ns.Model}
     */
    ns.Model.prototype.prepareRequest = function(requestID) {
        this.requestID = requestID;
        this.retries++;
        this.promise = new Vow.Promise();

        return this;
    };

    /**
     * Сообщает моделе о том, что ее запрос завершился.
     * При этом модель может быть в любом статусе.
     */
    ns.Model.prototype.finishRequest = function() {
        if (this._errorFixingPromise) {
            this._errorFixingPromise.then(this.__finishRequest, this.__finishRequest, this);

        } else {
            this.__finishRequest();
        }
    };

    ns.Model.prototype.__finishRequest = function() {
        if (this._errorFixingPromise) {
            // удаляем промисы при завершении исправления
            this._errorFixingPromise = null;
            // количество попыток надо обнулить
            this.retries = 0;
        }

        this.promise.fulfill();
    };

    /**
     *
     * @param {ns.Model[]} models
     */
    ns.Model.prototype.destroyWith = function(models) {
        ns.Model.destroyWith(this, models);
    };

    /**
     * Models factory. Returns cached instance or creates new.
     * @static
     * @param {string} id Model's ID.
     * @param {object} [params] Model's params.
     * @returns {ns.Model}
     */
    ns.Model.get = function(id, params) {
        var model = this._find(id, params);

        if (!model) {
            var Ctor = _ctors[id];
            model = new Ctor();
            model._init(id, params);

            // сохраняем модели в кеш, за исключение do-моделей
            if ( !model.isDo() ) {
                _cache[ id ][ model.key ] = model;
            }
        }

        model._reinit();

        return model;
    };

    /**
     * Returns valid cached model instance.
     * @param {string} id Model's ID.
     * @param {object} [params] Model's params
     * @returns {ns.Model|null}
     */
    ns.Model.getValid = function(id, params) {
        var model = this._find(id, params);
        if (model && model.isValid()) {
            return model;
        }
        return null;
    };

    /**
     * Returns cached model instance.
     * @param {string} id Model's ID.
     * @param {object} [params] Model's params
     * @returns {ns.Model|null}
     * @private
     */
    ns.Model._find = function(id, params) {
        ns.assert((id in _infos), 'ns.Model', "'%s' is not defined", id);

        var key = ns.Model.key(id, params);
        return _cache[id][key] || null;
    };

    /**
     * Completely destroy model and delete it from cache.
     * @param {ns.Model} model
     */
    ns.Model.destroy = function(model) {
        // do-models are not cached
        if ( model.isDo() ) {
            return;
        }

        var id = model.id;
        var key = model.key;

        var cached = _cache[id][key];
        if (cached) {
            model.destroy();
        }
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @returns {boolean}
     */
    ns.Model.isValid = function(id, params) {
        return !!ns.Model.getValid(id, params);
    };

    /**
     * Определяет новую модель.
     * @param {string} id Название модели.
     * @param {object} [info]
     * @param {Function} [info.ctor] Конструтор.
     * @param {object} [info.methods] Методы прототипа.
     * @param {object} [info.params] Параметры модели, участвующие в формировании уникального ключа.
     * @param {ns.Model|String} [base=ns.Model] Базовый класс для наследования или название ранее объявленной модели.
     * @examples
     * //  Простая модель, без параметров.
     * ns.Model.define('profile');
     *
     * ns.Model.define('album', {
     *   params: {
     *     //  Любое значение, кроме null расценивается как дефолтное значение этого параметра.
     *     //  На самом деле, конечно, не любое -- смысл имеют только Number и String.
     *     'author-login': null,
     *     'album-id': null,
     *
     *     //  Этим двум параметрам заданы дефолтные значения.
     *     'page': 0,
     *     'pageSize': 20
     *     }
     * });
     */
    ns.Model.define = function(id, info, base) {
        ns.assert(!(id in _infos), 'ns.Model', "Can't redefine '%s'", id);

        info = info || {};

        // Model becomes ModelCollection if it has "isCollection" or "split" property
        if (typeof info.isCollection === 'undefined') {
            info.isCollection = !!info.split;
        }

        var baseClass = base;
        if (typeof base === 'string') {
            // если указана строка, то берем декларацию ns.Model
            baseClass = _ctors[base];
            ns.assert(baseClass, 'ns.Model', "Can't find '%s' to extend '%s'", base, id);

        } else if (!base) {
            // если не указан, то определяем базовый класс из info
            if (info.uniq) {
                baseClass = ns.ModelUniq;
            } else if (info.isCollection) {
                baseClass = ns.ModelCollection;
            } else {
                baseClass = ns.Model;
            }
        }

        var ctor = info.ctor || function() {};
        // Нужно унаследоваться от base и добавить в прототип info.methods.
        ctor = no.inherit(ctor, baseClass, info.methods);

        /**
         * Флаг, что info уже подготовили
         * @type {boolean}
         */
        info.ready = false;

        // часть дополнительной обработки производится в ns.Model.info
        // т.о. получаем lazy-определение

        _infos[id] = info;
        _ctors[id] = ctor;

        //  Создаем пустой кэш для всех моделей с данным id.
        _cache[id] = {};

        return ctor;
    };

    /**
     * Устанавливает модели в начальное состояние
     * @private
     */
    ns.Model._reset = function() {
        _cache = {};
        _ctors = {};
        _infos = {};
    };

    /**
     * Удаляет экземпляры моделей
     * @private
     */
    ns.Model._clear = function() {
        for (var id in _infos) {
            _cache[id] = {};
        }
    };

    /**
     * Returns model's info
     * @param {string} id Model ID.
     * @returns {object}
     * @throws Throws exception if model is not defined.
     */
    ns.Model.info = function(id) {
        var info = ns.Model.infoLite(id);

        if (!info.ready) {
            /**
             * Параметры моделей.
             * @type {object}
             */
            info.params = info.params || {};

            /**
             * Обработчики событий.
             * @type {object}
             */
            info.events = info.events || {};

            /**
             * Флаг do-модели. Модель, которая изменяет данные.
             * Для do-моделей отдельные правила кэширования и построения ключей.
             * @type {Boolean}
             */
            info.isDo = /^do-/.test(id);

            info.ready = true;
        }
        return info;
    };

    /**
     * Returns model's info without processing.
     * @param {string} id Model ID.
     * @returns {object}
     */
    ns.Model.infoLite = function(id) {
        var info = _infos[id];
        ns.assert(info, 'ns.Model', "'%s' is not defined", id);

        return info;
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @param {object} [info]
     * @returns {string}
     * @static
     */
    ns.Model.key = function(id, params, info) {
        return ns.Model.getKeyAndParams(id, params, info).key;
    };

    /**
     * Возвращает ключ и собственные параметры модели.
     * @param {string} id
     * @param {object} params
     * @param {object} [info]
     * @returns {object}
     * @static
     */
    ns.Model.getKeyAndParams = function(id, params, info) {
        info = info || ns.Model.info(id);

        //  Для do-моделей ключ строим особым образом.
        if (info.isDo) {
            return {
                key: 'do-' + id + '-' + _keySuffix++,
                params: params
            };
        }

        var keyPrefix = 'model=' + id;
        var keyParams = ns.Model._getKeyParams(id, params, info);

        return {
            key: ns.key(keyPrefix, keyParams),
            params: keyParams
        };
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @param {object} info
     * @returns {*}
     * @private
     */
    ns.Model._getKeyParams = function(id, params, info) {
        params = params || {};
        info = info || ns.Model.info(id);

        if (typeof info.params === 'function') {
            return info.params(params);
        }

        var defaults = info.params;
        var pNames = info.pNames || (info.pNames = Object.keys(info.params));
        var result = {};

        for (var i = 0, l = pNames.length; i < l; i++) {
            var pName = pNames[i];
            var pValue = params[pName];

            //  Нельзя просто написать params[pName] || defaults[pName] --
            //  т.к. params[pName] может быть 0 или ''.
            pValue = (pValue === undefined) ? defaults[pName] : pValue;

            if (pValue != null) {
                result[pName] = pValue;
            }
        }

        // динамическая доработа параметров напильником
        if ('function' === typeof info.paramsRewrite) {
            result = info.paramsRewrite(result);
        }

        return result;
    };

    /**
     * Инвалидирует все модели с заданным id, удовлетворяющие filter.
     * @static
     * @param {string} id ID модели.
     * @param {Function} [filter] Функция-фильтр, принимающая параметром модель и возвращающая boolean.
     */
    ns.Model.invalidate = function(id, filter) {
        filter = filter || function() { return true; };

        var models = _cache[id];

        for (var key in models) {
            var model = models[key];
            if (filter(model)) {
                model.invalidate();
            }
        }
    };

    /**
     * Модель должна удалиться вместе с переданными моделями.
     * @param { ns.Model } targetModel - модель, которую надо удалить при удалении связанных моделей
     * @param { ns.Model | ns.Model[] } withModels - связанные модели
     */
    ns.Model.destroyWith = function(targetModel, withModels) {
        if (!Array.isArray(withModels)) {
            withModels = [ withModels ];
        }

        for (var i = 0, len = withModels.length; i < len; i++) {
            var model = withModels[i];

            ns.assert((model instanceof ns.Model), 'ns.Model', "destroyWith called for '%s' while one of the withModels is not instance of ns.Model", targetModel.id);

            // при уничтожении модели, с которой связана текущая - она тоже должна быть уничтожена
            model.on('ns-model-destroyed', function() {
                ns.Model.destroy(targetModel);
            });
        }
    };

    /**
     *
     * @param {ns.Model} model
     * @returns {boolean}
     */
    ns.Model.isCollection = function(model) {
        return (model.info || ns.Model.infoLite(model.id)).isCollection;
    };

    /**
     * Проходит по всем инстансам модели и передаёт их в callback.
     * @param {string} id идентификатор модели
     * @param {Function} callback
     */
    ns.Model.traverse = function(id, callback) {
        // вызов infoLite нужен, чтобы бросить ошибку в случае, если модель не определена
        ns.Model.infoLite(id);
        ns.assert(('function' === typeof callback), 'ns.Model.traverse', 'callback must be a function');

        var models = _cache[id];

        for (var key in models) {
            callback(models[key]);
        }
    };

    /**
     * Опции изменения модели.
     * @typedef {object} ns.Model~setOptions
     * @property {boolean} [silent = false] Не генерировать событие об изменении (ns-model-changed).
     * @property {string} [jpath] jpath, по которому произошло изменение
     */

    // ----------------------------------------------------------------------------------------------------------------- //

    // TODO а это кто-то использует вообще? я сюда не смотрел совсем :)

    /**
     * Это набор хэлперов для модели, делающего групповые запросы,
     * т.е. в качестве параметра у него есть массив
     * хэлперы позволяют каждый последующий раз искать в массиве значения,
     * которые ранее не грузились (уникальные) и грузить только их
     * @class
     * @augments ns.Model
     */
    ns.ModelUniq = function() {};

    no.inherit(ns.ModelUniq, ns.Model);

    ns.ModelUniq.prototype.__superInit = ns.ModelUniq.prototype._init;

    ns.ModelUniq.prototype._init = function(id) {
        // добавляем дефолтное событие changed
        var info = ns.Model.info(id);
        info.events.changed = info.events.changed || [];
        var onchangedCallbacks = info.events.changed;

        var cb = function() {
            //TODO: по-хорошему надо записывать все данные в один кеш и брать всегда все оттуда, а не ходить по всем экземплярам и собирать данные
            //Как только собрался кэш запоминаем какие ключи у нас есть
            var that = this;
            var uniq = this.params[this.uniqName];
            if (!this.uniqCached) { this.uniqCached = {}; }

            uniq.forEach(function(i, v) { that.uniqCached[v] = true; });
        };

        if (Array.isArray(onchangedCallbacks)) {
            onchangedCallbacks.unshift(cb);
        } else {
            info.events.changed = [cb, info.events.changed];
        }

        this.__superInit.apply(this, arguments);
    };

    ns.ModelUniq.prototype._superIsValid = ns.Model.prototype.isValid;
    /**
     * Исходя из ключа определяет, есть ли у нас уже запрашиваемая информация
     */
    ns.ModelUniq.prototype.isValid = function() {
        // если в ключе не присутсвует наш уникальный параметр
        // значит запрашивать 'ничего' не планируется,
        // а 'ничего' у нас закэшировано и так
        if (this.key.indexOf('&' + this.uniqName + '=') === -1) {
            return true;
        }
        return this._superIsValid();
    };

    /**
     * Имя значения в params, которое является массивом
     * @private
     * @type String
     */
    ns.ModelUniq.prototype.uniqName = '';

    /**
     * Название массива в кэше,
     * в котором должны храниться уникальные значения
     * @private
     * @type String
     */
    ns.ModelUniq.prototype.uniqPath = '';

    /**
     * Кэш с уже загруженными значениями
     * @private
     * @type Object
     */
    ns.ModelUniq.prototype.uniqCached = null;

    /**
     * Хэлпер, который помогает вырезать из параметров уже загруженные значения
     * @param {object} params
     * @param {object} cached ссылка, на объект, в который будет сложена закэшированная часть параметров
     * @type Object
     */
    ns.ModelUniq.prototype.uniq = function(params, cached) {
        var that = this;
        var name = this.uniqName;
        var copy = no.extend({}, params);
        if (!this.uniqCached) { this.uniqCached = {}; }

        // создаём ту же структуру, что и в оригинальных параметрах
        if (cached) {
            for (var k in params) {
                cached[k] = k === name ? [] : params[k];
            }
        }

        copy[name] = [].concat(copy[name]).map(function(v) {
            if (that.uniqCached[v]) {
                if (cached) {
                    cached[name].push(v);
                }

                return null;

            } else {
                return v;
            }
        });

        if (!copy[name].length) {
            delete copy[name];
        }

        if (cached && !cached[name].length) {
            delete cached[name];
        }

        return copy;
    };

    /**
     * Из ключа кэша делает массив по параметру, уникальность которого достигаем
     * @private
     * @param {string} key
     * @type Array
     */
    ns.ModelUniq.prototype.uniqFromKey = function(key) {
        return ((key.split(this.uniqName + '=')[1] || '').split('&')[0] || '').split(',');
    };

    /**
     * Вырезает из кэша xml для конкретного значения
     * @private
     * @abstract
     * @param {Node} xml
     * @param {string} uniq
     * @type Node
     */
    ns.ModelUniq.prototype.uniqFromJSON = ns.todo;

    /**
     * Возвращает кэш по параметрам
     * @returns {*}
     */
    ns.ModelUniq.prototype.getData = function(params) {
        var that = this;
        var path = this.uniqPath;
        var uniqs = [].concat(params[this.uniqName]);
        var data = {};
        data[path] = [];

        var modelsCache = _cache[this.id];
        for (var key in modelsCache) {
            var model = modelsCache[key];

            var arrKey = that.uniqFromKey(key);

            for (var i = 0, j = uniqs.length; i < j; i++) {
                // если требуемое значение есть в кэше
                if (arrKey.indexOf(uniqs[i]) > -1) {
                    // извлекаем значение из кэша по ключу
                    var value = that.uniqFromJSON(model.data, uniqs[i]);
                    if (value) {
                        data[path].push(value);
                    }
                    uniqs.splice(i, 1);
                    i--;
                }
            }
        }

        return data;
    };

})();

/* ../src/ns.model.js end */

    /* ../src/ns.modelCollection.js begin */
(function() {

    /**
     * Создает модель-коллекцию.
     * @classdesc Модель-коллекция.
     * @tutorial ns.modelCollection
     * @constructor
     * @augments ns.Model
     */
    ns.ModelCollection = function() {};

    no.inherit(ns.ModelCollection, ns.Model);

    /**
     * Дефолтное значение jpath
     * по которому сплит будет искать коллекцию
     * @type {String}
     */
    ns.ModelCollection.prototype.DEFAULT_ITEMS_SPLIT = '.items';

    /**
     *
     * @private
     */
    ns.ModelCollection.prototype._init = function() {
        /**
         * Хэшик с событиями, навешанными на элементы коллекции.
         * @type {object}
         * @private
         */
        this._modelsEvents = {};

        /**
         * Массив элементов колелкции.
         * @type {ns.Model[]}
         */
        this.models = [];

        ns.Model.prototype._init.apply(this, arguments);
    };

    /**
     *
     * @returns {{}|*}
     */
    ns.ModelCollection.prototype.getData = function() {
        // TODO а точно это нужно? Можно ведь просто всегда взять элементы из collection.models.

        // это составная модель —
        // нужно склеить все данные
        // из моделей её составляющих
        if (this.isValid()) {
            var jpathItems;

            if (this.info.split) {
                jpathItems = this.info.split.items;
            } else if (this.info.jpathItems) {
                jpathItems = this.info.jpathItems;
            } else {
                jpathItems = this.DEFAULT_ITEMS_SPLIT;
            }

            // если нет поля data сделаем его
            if (!this.data) {
                this.data = {};
            }

            // если корень (this.data)
            if (jpathItems === '/') {
                // нельзя передать this.data в функцию и ждать, что он станет пустым массивом,
                // поэтому делаем это руками
                this.data = [];

            } else {
                // делаем нужное поле в .data и делаем его пустым
                no.jpath.set(jpathItems, this.data, []);
            }
            // ссылка куда вставлять данные моделей
            var items = no.jpath(jpathItems, this.data);

            // пишем новые
            this.models.forEach(function(model) {
                items.push( model.getData() );
            });
        }
        return this.data;
    };

    /**
     *
     * @private
     */
    ns.ModelCollection.prototype._reset = function() {
        ns.Model.prototype._reset.apply(this, arguments);

        this.clear();
    };

    /**
     * Разбивает данные через jpath описанный в info.split
     * на составные модели
     * @param {*} data Новые данные.
     * @param {ns.Model~setOptions} [options] Флаги.
     * @private
     */
    ns.ModelCollection.prototype._beforeSetData = function(data, options) {
        var splitInfo = this.info.split;

        if (splitInfo) {
            // по умолчанию будем искать коллекцию в поле items
            var items = no.jpath(splitInfo.items || this.DEFAULT_ITEMS_SPLIT, data);
            var models = this._splitModels(items, options);

            var insert = this.__filterExistsModels(this.models, models);
            var remove = this.__filterExistsModels(models, this.models);

            this.__removeModels(remove);
            this.__insertModels(insert, 0);

            this.models = models;

        } else {
            this.clear();
        }

        // TODO может быть стоит удалять данные split-а?

        return data;
    };

    /**
     * Создает модели из разбитых данных
     *
     * @param { Array } items – массив данных для будущих подмоделей
     * @param {ns.Model~setOptions} [options] Флаги.
     * @returns { ns.Model[] } – массив полученных подмоделей
     * @private
     */
    ns.ModelCollection.prototype._splitModels = function(items, options) {
        var splitInfo = this.info.split;
        var models = [];

        for (var i = 0, j = items.length; i < j; i++) {
            var item = items[i];

            var params = {};
            for (var key in splitInfo.params) {
                params[key] = no.jpath(splitInfo.params[key], item);
            }

            // идентификатор подмодели берется из info.model_id
            var modelId;
            if (typeof splitInfo.model_id === 'function') {
                // если model_id - функция, то передаем туда данные и параметры,
                // а она должна вернуть id модели
                modelId = splitInfo.model_id(item, params);
            } else {
                modelId = splitInfo.model_id;
            }

            if (modelId) {
                models.push(ns.Model.get(modelId, params).setData(item, options));
            }
        }

        return models;
    };

    /**
     * Подписывает коллекию на события из подмоделей
     *
     * @param {ns.Model} model
     * @private
     */
    ns.ModelCollection.prototype._subscribeSplit = function(model) {
        var that = this;

        this.bindModel(model, 'ns-model-changed', function(evt, jpath) {
            that.onItemChanged(evt, model, jpath);
        });

        this.bindModel(model, 'ns-model-touched', function(evt) {
            that.onItemTouched(evt, model);
        });

        this.bindModel(model, 'ns-model-before-destroyed', function(evt) {
            that.onItemDestroyed(evt, model);
        });
    };

    /**
     * Возвращает массив из modelsToCheck, которых нет в currentModels.
     * @param {ns.Model[]} currentModels
     * @param {ns.Model[]} modelsToCheck
     * @private
     */
    ns.ModelCollection.prototype.__filterExistsModels = function(currentModels, modelsToCheck) {
        var modelsHash = this.__buildModelsHash(currentModels);

        var newModels = [];
        // Ищем новые модели
        for (var i = 0, length = modelsToCheck.length; i < length; i++) {
            var model = modelsToCheck[i];

            // hasOwnProperty чуть быстрее, чем простой поиск по ключу,
            // потому что не ищет в прототипе
            if (!modelsHash.hasOwnProperty(model.key)) {
                newModels.push(model);
            }
        }

        return newModels;
    };

    /**
     * Возвращает хеш с ключами моделей.
     * @param {ns.Model[]} models
     * @private
     */
    ns.ModelCollection.prototype.__buildModelsHash = function(models) {
        var modelsHash = {};
        for (var i = 0, j = models.length; i < j; i++) {
            modelsHash[models[i].key] = 0;
        }

        return modelsHash;
    };

    /**
     * Подписывает callback на событие eventName модели model
     *
     * @param {ns.Model} model
     * @param {string} eventName
     * @param {function} callback
     */
    ns.ModelCollection.prototype.bindModel = function(model, eventName, callback) {
        var events = (this._modelsEvents[model.key] || (this._modelsEvents[model.key] = {}));

        model.on(eventName, callback);
        events[eventName] = callback;
    };

    ns.ModelCollection.prototype.unbindModel = function(model, eventName) {
        var events = this._modelsEvents[model.key];
        if (!events || !events[eventName]) {
            return;
        }

        model.off(eventName, events[eventName]);
        delete events[eventName];
    };

    /**
     * Метод реакции на изменения элементов коллекции.
     * @description Основной смысл этого метода в том, чтобы его можно было переопределить
     * и триггерить изменение коллекции только для части изменений элементов коллекции.
     * @param {string} evt Событие 'ns-model-changed' от элемента коллекции
     * @param {ns.Model} model Измененный элемент коллекции.
     * @param {string} jpath JPath, по которому произошли изменения.
     * @fires ns.ModelCollection#ns-model-changed
     */
    ns.ModelCollection.prototype.onItemChanged = function(evt, model, jpath) {
        // TODO тут можно триггерить много чего, но мы пока этого не делаем:
        // this.trigger('ns-model-changed.items[3].some.inner.prop'); // (ЭТОГО СЕЙЧАС НЕТ).

        /**
         * Сообщает об изменении элементов коллекции.
         * @event ns.ModelCollection#ns-model-changed
         * @param {object} info Объект с информацией об изменениях.
         * @param {ns.Model} info.model Измененный элемент коллекции.
         * @param {string} info.jpath JPath, по которому произошли изменения.
         */
        this.trigger('ns-model-changed', { 'model': model, 'jpath': jpath });
    };

    /**
     * Метод вызывается, когда у элемента коллекции меняется версия.
     * @param {string} evt Событие 'ns-model-touched' от элемента коллекции
     * @param {ns.Model} model Измененный элемент коллекции.
     */
    ns.ModelCollection.prototype.onItemTouched = function(evt, model) {
        /* jshint unused: false */
        // У коллекции есть собственная версия (this._versionSelf) и версия элементов коллекции (this._version).
        // Когда меняется элемент коллекции - версия самой коллекции не меняется.
        this._version++;
    };

    /**
     * Метод вызывается, когда уничтожается элемент коллекции.
     * @param {string} evt Событие 'ns-model-before-destroyed' от элемента коллекции.
     * @param {ns.Model} model Уничтожаемый элемент коллекции.
     */
    ns.ModelCollection.prototype.onItemDestroyed = function(evt, model) {
        this.remove(model);
    };

    /**
     * Returns data version (included items version).
     * @returns {number}
     */
    ns.ModelCollection.prototype.getSelfVersion = function() {
        return this._versionSelf;
    };

    /**
     * @borrows ns.Model.prototype._incVersion as ns.ModelCollection.prototype._incVersion
     */
    ns.ModelCollection.prototype._incVersion = function() {
        ns.Model.prototype._incVersion.apply(this, arguments);

        /**
         * _versionSelf показывает версию изменений внешней модели
         * в то время, как _version - последнее время изменения внешней или внутренней модели
         * @type {*}
         * @private
         */
        this._versionSelf = this._version;
    };

    /**
     * Удаляет подписку коллекции на подмодель
     * Обязательно при удалении подмодели из коллекции
     *
     * @param {ns.Model} model
     * @private
     */
    ns.ModelCollection.prototype._unsubscribeSplit = function(model) {
        if (model.key in this._modelsEvents) {
            var events = this._modelsEvents[model.key];

            for (var eventName in events) {
                model.off(eventName, events[eventName]);
            }

            delete this._modelsEvents[model.key];
        }
    };

    /**
     * Очищает коллекцию от моделей.
     * Не путать с remove.
     * @fires ns.ModelCollection#ns-model-remove
     */
    ns.ModelCollection.prototype.clear = function() {
        var models = this.models;

        // Это нужно и для начальной инициализации моделей.
        // Сначала удаляем все элементы, потом отписываем и бросаем событие

        /**
         * Массив с моделями - элементами коллекции.
         * @type {ns.Model[]}
         */
        this.models = [];

        if (models && models.length) {
            var that = this;
            models.forEach(function(model) {
                that._unsubscribeSplit(model);
            });

            // бросаем событие об удалении всех элементов
            this.trigger('ns-model-remove', models);
        }
    };

    /**
     * Вставляет подмодели в коллекцию
     *
     * @param {ns.Model[] | ns.Model} models – одна или несколько подмоделей для вставки
     * @param {number} [index] – индекс позиции, на которую вставить подмодели. Если не передано - вставка в конец.
     *
     * @returns {Boolean} – признак успешности вставки
     * @fires ns.ModelCollection#ns-model-insert
     */
    ns.ModelCollection.prototype.insert = function(models, index) {
        // переинициализация после #destroy()
        this._reinit();

        if (isNaN(index)) {
            index = this.models.length;
        }

        if (!Array.isArray(models)) {
            models = [ models ];
        }

        var deduplicatedModels = [];
        var newModelsHash = this.__buildModelsHash(models);
        for (var i = 0, j = models.length; i < j; i++) {
            var model = models[i];
            if (newModelsHash[model.key] === 0) {
                deduplicatedModels.push(model);
                newModelsHash[model.key]++;
            }
        }

        var insertion = this.__filterExistsModels(this.models, deduplicatedModels);

        return this.__insertModels(insertion, index);
    };

    /**
     * Вставляет модели в коллекцию
     *
     * @param {ns.Model[]} models – массив моделей
     * @param {Number} index – индекс позиции, на которую вставить подмодели.
     * @private
     */
    ns.ModelCollection.prototype.__insertModels = function(models, index) {
        for (var i = 0, length = models.length; i < length; i++) {
            this.models.splice(index + i, 0, models[i]);
            this._subscribeSplit(models[i]);
        }

        // оповестим всех, что вставили подмодели
        if (models.length > 0) {
            // если вставка данных состоялась, считаем модель валидной
            this.status = this.STATUS.OK;

            /**
             * Сообщает о вставке новых элементов коллекции.
             * @event ns.ModelCollection#ns-model-insert
             * @param {array} insertion Массов вставленных элементов.
             */
            this.trigger('ns-model-insert', models);

            return true;
        }

        return false;
    };

    /**
     * Удаляет элементы коллекции.
     *
     * @param {ns.Model | Number | ns.Model[] | Number[]} models – подмодели или индексы подмодели, которую надо удалить
     * @returns {Boolean} – признак успешности удаления.
     * @fires ns.ModelCollection#ns-model-remove
     */
    ns.ModelCollection.prototype.remove = function(models) {
        if (!Array.isArray(models)) {
            models = [ models ];
        }

        // преобразуем индексы в экземпляры,
        // потому с индексами работать небезопасно из-за их смещения после удаления
        var itemsToRemove = this._modelsIndexToInstance(models);
        var removedItems = [];

        // пробегаем по элементам, которые надо удалить, и ищем их в коллекции
        for (var i = 0, j = itemsToRemove.length; i < j; i++) {
            var itemToRemove = itemsToRemove[i];
            var itemToRemoveIndex = this.models.indexOf(itemToRemove);

            // если модель есть в списке на удаление
            if (itemToRemoveIndex > -1) {
                itemToRemove._itemToRemoveIndex = itemToRemoveIndex;
                removedItems.push(itemToRemove);
            }
        }

        return this.__removeModels(removedItems);
    };

    /**
     * Удаляет модели из коллекции
     *
     * @param {ns.Model[]} models – список моделей
     * @private
     */
    ns.ModelCollection.prototype.__removeModels = function(models) {

        // Надо отсортировать модели по убыванию индекса в this.models и удалять их с конца
        models = models.sort(function(a, b) {return b._itemToRemoveIndex - a._itemToRemoveIndex;});

        for (var i = 0, length = models.length; i < length; i++) {
            // отписываем ее
            this._unsubscribeSplit(models[i]);
            this.models.splice(models[i]._itemToRemoveIndex, 1);
        }

        if (models.length) {
            /**
             * Сообщает об удалении элементов коллекции.
             * @event ns.ModelCollection#ns-model-remove
             * @param {array} modelsRemoved Массив удаленных моделей.
             */
            this.trigger('ns-model-remove', models);
            return true;
        }

        return false;
    };

    /**
     * Преобразует индексы моделей в их экземпляры.
     * @param {ns.Model[]|Number[]} models Элементы коллекции или их индексы.
     * @returns {ns.Model[]}
     * @private
     */
    ns.ModelCollection.prototype._modelsIndexToInstance = function(models) {
        var items = [];

        for (var i = 0, j = models.length; i < j; i++) {
            var index = models[i];
            if (typeof index === 'number') {
                var item = this.models[index];
                if (this.models[index]) {
                    items.push(item);
                }
            } else {
                items.push(index);
            }
        }

        return items;
    };

})();

/* ../src/ns.modelCollection.js end */

    /* ../src/ns.layout.js begin */
(function() {

    /**
     * Модуль "Раскладка страницы".
     * @tutorial ns.layout
     * @namespace
     */
    ns.layout = {};

    //  Хранилище "сырых" layout'ов.
    var _pages = {};

    var hasSpacesRE = /\s+/;

    /**
     * Определяет раскладку.
     * @param {string} id ID новой раскладки.
     * @param {object} layout Раскладка.
     * @param {string} [parent_id] ID родителя
     */
    ns.layout.define = function(id, layout, parent_id) {
        if ( _pages[id] ) {
            throw new Error("[ns.layout] Can't redefine '" + id + "'");
        }

        _pages[id] = {
            layout: layout,
            parent_id: parent_id
        };
    };

    /**
     * Удаляет определение раскладки.
     * @param {string} id ID раскладки.
     */
    ns.layout.undefine = function(id) {
        delete _pages[id];
    };

    /**
     * Устанавливает layout в начальное состояние
     * @private
     */
    ns.layout._reset = function() {
        _pages = {};
    };

    /**
     * Возвращает раскладку страницы с заданным id и params.
     * @param {string} id ID раскладки
     * @param {object} [params] Параметры страницы.
     * @returns {object}
     */
    ns.layout.page = function(id, params) {
        var raw = _pages[id];
        if (!raw) {
            throw new Error("[ns.layout] '" + id + "' is not defined");
        }

        var layout = compile(raw.layout, params);

        if (raw.parent_id) {
            var parent = ns.layout.page(raw.parent_id, params);

            layout = inherit(layout, parent);
        }

        return layout;
    };

    /**
     * Генерирует и регистрирует простой layout из одного вида
     * @param {string} viewId ID вида
     * @param {string} [prefix="ns-auto-layout-"] Префикс названия layout
     */
    ns.layout.generateSimple = function(viewId, prefix) {
        prefix = prefix || 'ns-auto-layout-';
        var layoutId = prefix + viewId;

        if (layoutId in _pages) {
            return layoutId;
        }

        var layout = {};
        layout[viewId] = {};
        ns.layout.define(layoutId, layout);

        return layoutId;
    };

    /**
     * Компилирует layout в зависимости от параметров params.
     * Интерполируем ключи, раскрываем шоткаты, вычисляем функции и т.д.
     * @param {*} layout
     * @param {object} params
     * @returns {object}
     */
    function compile(layout, params) {
        var t = {};
        if (typeof layout === 'string') {
            //  Строка 'folders' является шоткатом для:
            //
            //  {
            //      'folders': true
            //  }
            //
            t[layout] = true;
            layout = t;

        } else if ( Array.isArray(layout) ) {
            //  Массив вида [ 'folders', 'labels' ] является шоткатом для:
            //
            //      {
            //          'folders': true,
            //          'labels': true
            //      }
            //
            //  Преобразуем массив в объект.
            for (var i = 0, l = layout.length; i < l; i++) {
                t[ layout[i] ] = true;
            }
            layout = t;

        }

        //  Рекурсивно компилируем значение каждого ключа и создаем новый объект result.
        var result = {};

        for (var raw_key in layout) {
            var key = raw_key;

            // быстро проверяем возможность интерполяции, чтобы зря не вызывать компиляцию
            if (raw_key.indexOf('{') > -1) {
                //  Ключ может быть с интерполяцией, так что вычисляем его.
                key = no.jpath.string(raw_key)(params);
            }

            var raw_value = layout[raw_key];
            var value;

            //  Интерпретируем значение, соответствующее ключу.
            switch (typeof raw_value) {
                //  Это функция, ее нужно вызвать и скомпилировать результат.
                case 'function':
                    value = compile( raw_value(params), params );
                    break;

                //  Это объект.
                case 'object':
                case 'string':
                    value = compile(raw_value, params);
                    break;

                default:
                    value = {};
            }

            result[cleanKey(key)] = {
                'type': getViewType(key),
                'views': value
            };
        }

        return result;
    }

    /**
     * Наследует layout от parent'а.
     * @param {object} layout
     * @param {object} parent
     * @returns {object}
     */
    function inherit(layout, parent) {
        var result = ns.object.clone(parent);

        for (var key in layout) {
            //  В ключе должен быть "путь" вида 'app left@ message content@'.
            var parts = key.split(hasSpacesRE);
            var l = parts.length;

            //  Путь должен заканчиваться на бокс.
            //  Т.е. на строку вида 'foo@'.
            //  Потому что можно переопределять только содержимое боксов.
            //  Изменять лэйаут блоков нельзя.
            if ( getViewType( parts[l - 1] ) !== ns.L.BOX ) {
                throw new Error("[ns.layout] Can't overwrite view layout '" + parts[l - 1] + "'");
            }

            var lvalue = result;
            for (var i = 0; i < l - 1; i++) {
                lvalue = lvalue[ cleanKey(parts[i]) ].views;
                if (!lvalue) {
                    throw new Error( '[no.layout] Path "' + parts.slice(0, i).join(' ') + '" is undefined in this layout and cannot be extended' );
                }
            }
            lvalue[ cleanKey(parts[l - 1]) ] = layout[key];
        }

        return result;
    }

    function getViewType(s) {
        var lastChar = s.substr(-1);
        if (lastChar === '@') {
            return ns.L.BOX;
        } else if (lastChar === '&') {
            return ns.L.ASYNC;
        }

        return ns.L.VIEW;
    }

    function cleanKey(key) {
        // если в ключе есть пробел, то это означает наследоание
        // в таких ключах не надо ничего вырезать
        if (hasSpacesRE.test(key)) {
            return key;
        }
        var ch = key.slice(-1);
        if (ch === '@' || ch === '&') {
            key = key.slice(0, -1);
        }
        return key;
    }

})();

/* ../src/ns.layout.js end */

    /* ../src/ns.log.js begin */
(function(ns) {

    /**
     * Модуль логирования ошибок.
     * @namespace
     */
    ns.log = {};

    /**
     * @param {...*} str
     */
    ns.log.debug = function(str) {
        /* jshint unused: false */
       console.log.apply(console, arguments);
    };

    /**
     * Логирует сообщение.
     * @param {string} name Название сообщение.
     * @param {object} [data] Данные
     * @param {string} [longText] Дополнительные данные. Длинная строка, которую надо разбить на части.
     */
    ns.log.info = function(name, data, longText) {
        /* jshint unused: false */
    };

    /**
     * Логирует ошибку.
     * @param {string} name Название ошибки.
     * @param {object} [data] Данные
     * @param {string} [longText] Дополнительные данные. Длинная строка, которую надо разбить на части.
     */
    ns.log.error = function(name, data, longText) {
        /* jshint unused: false */
    };

    /**
     * Логирует JS-исключение.
     * @param {string} name Название ошибки.
     * @param {Error} exception Пойманное исключение.
     * @param {object} [data] Дополнительные данные.
     */
    ns.log.exception = function(name, exception, data) {
        /* jshint unused: false */
    };

})(ns);

/* ../src/ns.log.js end */

    /* ../src/ns.page.js begin */
(function() {

    /**
     * Модуль управления "страницей" и переходами между ними.
     * @namespace
     */
    ns.page = {};

    /**
     * Current page params
     * @type {{page: string, params: Object}}
     */
    ns.page.current = {};

    /**
     * Адрес текущей страницы
     * @type {string}
     */
    ns.page.currentUrl = null;

    /**
     * Действие с историей по умолчанию.
     * @constant
     * @type {string}
     */
    ns.page.DEFAULT_HISTORY_ACTION = 'push';

    /**
     * Осуществляем переход по ссылке.
     * @param {string} [url=ns.page.getCurrentUrl()]
     * @param {string} [historyAction='push'] Действие с историей браузера: добавить ('push'), заменить ('replace'), ничего не делать ('preserve').
     * @returns {Vow.Promise}
     * @fires ns.page#ns-page-after-load
     * @fires ns.page#ns-page-before-load
     * @fires ns.page#ns-page-error-load
     */
    ns.page.go = function(url, historyAction) {
        if (!historyAction) {
            historyAction = ns.page.DEFAULT_HISTORY_ACTION;

        } else if (historyAction === true) {
            // этот вариант оставлен для совместимости
            historyAction = 'replace';
        }

        url = url || ns.page.getCurrentUrl();

        // возможность заблокировать переход
        if (!ns.page.block.check(url)) {
            // Если мы нажали кнопку "Назад" в браузере, то событие popstate произойдет уже после смены url
            // соответственно надо поменять урл на старый, если он поменялся
            if (url !== ns.page.currentUrl) {
                ns.history.replaceState(ns.page.currentUrl);
            }
            return Vow.reject('block');
        }

        var route = ns.router(url);

        if (route.page === ns.R.NOT_APP_URL) {
            if (historyAction === 'replace') {
                window.location.replace(route.redirect);
            } else {
                window.location = route.redirect;
            }

            // return empty non-resolved promise becase we are redirecting now
            return new Vow.Promise();
        }

        /**
         * Сейчас будет переход на другую страницу.
         * @event ns.page#ns-page-before-load
         * @param routes {array} Маршруты: 0 - предыдущий, 1 - новый.
         * @param url {string} Новый урл.
         */
        ns.events.trigger('ns-page-before-load', [ns.page.current, route], url);

        // не надо пушить в историю тот же самый URL
        // это очень легко сделать, если просто обновлять страницу через ns.page.go()
        if (historyAction === 'push' && url === ns.page.currentUrl) {
            historyAction = 'preserve';
        }

        return ns.page.followRoute(route)
            .then(function() {

                ns.page._setCurrent(route, url);
                ns.page._fillHistory(url, historyAction);

                // router says "redirect"
                if (route.page === ns.R.REDIRECT) {
                    return ns.page.redirect(route.redirect);
                }

                ns.page.title();

                return ns.page.startUpdate(route);
            }, triggerPageErrorLoad);
    };

    ns.page.followRoute = function(route) {
        /* jshint unused: false */
        return Vow.fulfill();
    };

    /**
     * Запускает процесс отрисовки страницы.
     * @param {ns.router~route} route Маршрут для перехода.
     * @returns {Vow.Promise}
     */
    ns.page.startUpdate = function(route) {
        var layout = ns.layout.page(route.page, route.params);

        var update = new ns.Update(ns.MAIN_VIEW, layout, route.params);
        return update.start().then(triggerPageAfterLoad, triggerPageErrorLoad);
    };

    /**
     * Заполняет ns.page.current перед запуском ns.Update
     * @param {ns.router~route} route Маршрут.
     * @param {string} url Новый урл.
     * @private
     */
    ns.page._setCurrent = function(route, url) {
        ns.page.current = route;
        ns.page.currentUrl = url;
    };

    /**
     * Заполняет историю переходов перез запуском ns.Update
     * @param {string} url Новый урл.
     * @param {string} action Действие (push/replace)
     * @private
     */
    ns.page._fillHistory = function(url, action) {
        // action еще может быть "preserve", т.е. ничего не делаем
        switch (action) {
            case 'init':
                ns.page.history.push(url);
                break;
            case 'push':
                ns.history.pushState(url);
                ns.page.history.push(url);
                break;
            case 'replace':
                ns.history.replaceState(url);
                ns.page.history.replace(url);
                break;
            case'redirect':
                ns.history.replaceState(url);
                ns.page.history.redirect(url);
                break;
        }
    };

    /**
     * Redirects to given url.
     * @param {string} url New page url.
     * @returns {Vow.Promise}
     */
    ns.page.redirect = function(url) {
        ns.history.replaceState(url);
        return ns.page.go(url, 'redirect');
    };

    /**
     * Sets document title.
     * @returns {string}
     */
    ns.page.title = function() {
        document.title = 'NoScript app ' + ns.page.currentUrl.url;
    };

    /**
     * Устанавливает начальное состояние
     * @private
     */
    ns.page._reset = function() {
        this.current = {};
        this.currentUrl = '';
    };

    /**
     * Returns default url for NoScript application.
     * Should be redefined.
     */
    ns.page.getDefaultUrl = function() {
        return ns.router.url('/');
    };

    /**
     * Calculates current application url, fed as default value for `ns.page.go`.
     */
    ns.page.getCurrentUrl = function() {
        return window.location.pathname + window.location.search;
    };

    /**
     * Триггерит событие "Произошла успешная загрузка страницы"
     * @param {*} val
     */
    function triggerPageAfterLoad(val) {
        /**
         * Произошла успешная загрузка страницы
         * @event ns.page#ns-page-after-load
         */
        ns.events.trigger('ns-page-after-load', val);

        // proxy fullfill value
        return val;
    }

    /**
     * Триггерит событие "Произошла неуспешная загрузка страницы"
     * @param {*} err
     */
    function triggerPageErrorLoad(err) {
        /**
         * Произошла неуспешная загрузка страницы
         * @event ns.page#ns-page-error-load
         */
        ns.events.trigger('ns-page-error-load', err);

        // proxy reject value
        return Vow.reject(err);
    }

})();

/* ../src/ns.page.js end */

    /* ../src/ns.page.block.js begin */
(function() {

    /**
     * Module to add checkers and block proceed to another URL.
     * @namespace
     */
    ns.page.block = {};

    /**
     * Array of checkers
     * @private
     * @type {Function[]}
     */
    ns.page.block._checkers = [];

    /**
     * Добавляет функцию блокировки.
     * @description
     * Функция блокировки должна вернуть false, если переход нельзя осуществить.
     * @param {Function} fn
     * @returns {ns.page.block}
     */
    ns.page.block.add = function(fn) {
        ns.page.block._checkers.push(fn);

        return this;
    };

    /**
     * Remove function to check.
     * @param {Function} fn
     * @returns {ns.page.block}
     */
    ns.page.block.remove = function(fn) {
        var checkers = ns.page.block._checkers;
        var index = checkers.indexOf(fn);
        if (index > -1) {
            checkers.splice(index, 1);
        }

        return this;
    };

    /**
     * Очищает все функции блокировки.
     * @returns {ns.page.block}
     */
    ns.page.block.clear = function() {
        ns.page.block._checkers = [];
        return this;
    };

    /**
     * Detect if possible to go to the url.
     * You can add your own checkers with ns.page.block.add(checkerFn)
     * @param {string} url URL to go.
     * @returns {Boolean}
     */
    ns.page.block.check = function(url) {
        var checkers = ns.page.block._checkers;
        for (var i = 0, j = checkers.length; i < j; i++) {
            if (checkers[i](url) === false) {
                return false;
            }
        }

        return true;
    };

})();

/* ../src/ns.page.block.js end */

    /* ../src/ns.page.history.js begin */
(function() {

    /**
     * Object to work with application history.
     * @namespace
     */
    ns.page.history = {};

    /**
     * Current application url.
     * @type {string}
     * @private
     */
    ns.page.history._current = null;

    /**
     * History of application urls.
     * @type {Array}
     * @private
     */
    ns.page.history._history = [];

    /**
     * Saves url in history.
     * @param {string} url
     */
    ns.page.history.push = function(url) {
        var nsHistory = ns.page.history;

        // save previous url to history
        if (nsHistory._current) {

            // prevent duplicates
            if (nsHistory._current !== url) {
                var prevPage = ns.page.history.getPrevious();

                // user pressed back button in browser
                if (prevPage === url) {
                    nsHistory._history.pop();

                } else {
                    nsHistory._history.push(nsHistory._current);
                }
            }
        }

        nsHistory._current = url;
    };

    /**
     * Replace url in history.
     * @param {string} url
     */
    ns.page.history.replace = function(url) {
        var nsHistory = ns.page.history;
        var previousUrl = nsHistory._history.pop();
        var currentUrl = nsHistory._current;

        if (previousUrl !== url && currentUrl !== url) {
            nsHistory._history.push(url);
        }

        // save current
        nsHistory._current = url;
    };

    ns.page.history.redirect = function(url) {
        var nsHistory = ns.page.history;

        nsHistory._current = url;
        nsHistory._previous = nsHistory.getPrevious();
    };

    /**
     * Go to previous page and delete it from history.
     * @returns {Vow.Promise}
     */
    ns.page.history.back = function() {
        var nsHistory = ns.page.history;

        var previousPage = nsHistory.getPrevious();
        if (previousPage) {
            // removes last entry
            nsHistory._history.pop();

        } else {
            // get default url
            previousPage = ns.page.getDefaultUrl();
        }

        // delete current history url
        nsHistory._current = previousPage;

        return ns.page.go(previousPage);
    };

    /**
     * Returns previous page.
     * @param {number} [n=0] N pages ago
     * @returns {string}
     */
    ns.page.history.getPrevious = function(n) {
        n = n || 0;
        var history = ns.page.history._history;
        var l = history.length;
        // Предыдущая страница, если есть.
        return history[l - n - 1];
    };

    /**
     * Сбрасывает данные в начальное состояние.
     * Метод используется в тестах.
     */
    ns.page.history.reset = function() {
        ns.page.history._current = null;
        ns.page.history._history = [];
    };

})();

/* ../src/ns.page.history.js end */

    /* ../src/ns.request.js begin */
(function() {

    /**
     * Делает запрос моделей с сервера.
     * Аргументы можно передавать в следующих форматах:
     *   - string item, params - одна модель и опциональные параметры для нее
     *     ns.request('model', params)
     *   - string[], params - массив моделей и опциональные единые для всех параметры
     *     ns.request(['model1', 'model2'], params)
     *   - object[] - массив моделей вида {id: modelName, params: modelParams}
     *     ns.request([
     *       {id: 'model1', params: params1},
     *       {id: 'model2', params: params2},
     *     ])
     *   - ns.Model[] - массив экземпляров моделей
     *     ns.request([ modelInstance1, modelInstance2 ]);
     * @param {String|Array} items Массив названий моделей.
     * @param {object} [params] Параметры моделей.
     * @param {object} [options] Опции запроса.
     * @param {Boolean} [options.forced=false] Не учитывать закешированность моделей при запросе.
     * @returns {Vow.Promise}
     * @namespace
     */
    ns.request = function(items, params, options) {
        return ns.request.models(items2models(items, params), options);
    };

    /**
     * Делает запрос моделей с сервера, не учитывая их закешированности.
     * @see ns.request
     * @param {String|Array} items Массив названий моделей.
     * @param {object} [params] Параметры моделей.
     * @param {object} [options] Опции запроса.
     * @param {Boolean} [options.forced=false] Не учитывать закешированность моделей при запросе.
     * @returns {Vow.Promise}
     * @memberOf ns.request
     * @name forcedRequest
     */
    ns.forcedRequest = function(items, params, options) {
        options = options || {};
        options.forced = true;
        return ns.request.models(items2models(items, params), options);
    };

    /**
     * Делает запрос моделей с сервера.
     * @param {ns.Model[]} models Массив моделей.
     * @param {object} [options] Опции запроса.
     * @param {Boolean} [options.forced=false] Не учитывать закешированность моделей при запросе.
     * @returns {Vow.Promise}
     */
    ns.request.models = function(models, options) {

        // Загрузка порционных данных. В этом случае грузим не саму модель, а порцию данных.
        models = models.map(function(model) {
            return model.getRequest ? model.getRequest() : model;
        });

        var request = new Request(models, options);

        return request.start();
    };

    /**
     * Дополнительные общие параметры запроса.
     * Эти параметры добавляются в любой запрос.
     * @public
     * @type {object}
     */
    ns.request.requestParams = {};

    /**
     * Добавляет к params, параметры из ns.request.requestParams.
     * @param {object} params Параметры запроса.
     */
    ns.request.addRequestParams = function(params) {
        no.extend(params, ns.request.requestParams);
    };

    /**
     * Урл до сервера.
     * @type {string}
     */
    ns.request.URL = '/models/';

    /**
     * Метод для проверки ответа данных.
     * Может использоваться, например, при проверки авторизации.
     * @returns {boolean}
     */
    ns.request.canProcessResponse = function() {
        return true;
    };

    /**
     * Устанавливает начальное состояние
     * @private
     */
    ns.request._reset = function() {
        ns.request.manager._keys = {};
    };

    /**
     * Обрабатывает ответ модели от сервера.
     * @param {ns.Model} model
     * @param {*} result
     */
    ns.request.extractModel = function(model, result) {
        var data;
        var error;
        if (!result) {
            error = {
                id: 'NO_DATA',
                reason: 'Server returned no data'
            };
        } else {
            data = model.extractData(result);
            if (!data) {
                error = model.extractError(result);
                if (!error) {
                    error = {
                        id: 'INVALID_FORMAT',
                        reason: 'response should contain result or error'
                    };
                }
            }
        }

        if (data) {
            model.setData(data);
        } else {
            model.setError(error);
        }
    };

    var REQUEST_ID = 0;

    var Request = function(models, options) {
        /**
         * ID запроса.
         * @type {number}
         * @private
         */
        this.id = REQUEST_ID++;

        /**
         * Массив запрашиваемых моделей
         * @type {ns.Model[]}
         * @private
         */
        this.models = models;

        /**
         * Опции запроса.
         * @type {object}
         * @private
         */
        this.options = options || {};

        this.promise = new Vow.Promise();
    };

    // ------------------------------------------------------------------------------------------------------------- //

    Request.prototype.start = function() {
        var loading = [];
        var requesting = [];

        var models = this.models;
        for (var i = 0, l = models.length; i < l; i++) {
            var model = models[i];

            var addRequest = ns.request.manager.add(model, this.id, this.options.forced);
            if (addRequest === true) {
                requesting.push(model);

            } else if (addRequest instanceof ns.Model) {
                loading.push(model);
            }
        }

        this.request(loading, requesting);

        return this.promise;
    };

    /**
     * Делаем запрос за моделями.
     * @param {ns.Model[]} loading Список моделей, которые уже грузятся.
     * @param {ns.Model[]} requesting Список моделей, которые надо запросить.
     */
    Request.prototype.request = function(loading, requesting) {
        var all = [];
        // promise от http-запроса
        var httpRequest;

        if (requesting.length) {

            var regularRequests = [];
            var customRequests = [];

            requesting.forEach(function(model) {
                // если у модели есть метод request, это значит, что она запросит себя сама
                if (typeof model.request === 'function') {

                    // Вызываем #request, он должен вернуть Vow.Promise.
                    // После завершения говорим об этом менеджеру, чтобы убрать запрос из очереди.
                    var modelRequestPromise = model.request().then(function() {
                        ns.request.manager.done(model);
                    }, function() {
                        ns.request.manager.done(model);
                    });

                    // это промис надо прописать модели,
                    // чтобы повторные запросы тоже отрезолвились
                    // @see ns.Model#prepareRequest
                    model.promise = modelRequestPromise;

                    // добавляем ко всем промисам, чтобы дождаться
                    customRequests.push(modelRequestPromise);
                } else {
                    regularRequests.push(model);
                }
            });

            all = all.concat(customRequests);

            if (regularRequests.length) {

                //  Запрашиваем модели, которые нужно запросить.
                var params = models2params(regularRequests);
                var modelsNames = regularRequests.map(models2name);
                ns.request.addRequestParams(params);
                // отдельный http-promise нужен для того, чтобы реквест с этой моделью, запрашиваемой в другом запросе,
                // мог зарезолвится без завершения http-запроса
                httpRequest = ns.http(ns.request.URL + '?_m=' + modelsNames.join(','), params);

                all = all.concat(regularRequests.map(model2Promise));
            }

        }/* else {
            //TODO: надо перепроверить поведение, если нет запросов
            // создаем фейковый зарезолвленный promise
            httpRequest = new no.Promise().resolve();
        }
        */

        if (loading.length) {
            //  Ждем все остальные модели, которые должны загрузиться (уже были запрошены).
            all = all.concat( loading.map(model2Promise) );
        }

        //  Мы ждём какие-то данные:
        //    * либо мы запросили какие-то новые модели;
        //    * либо мы ждем ранее запрошенные модели.
        if (all.length) {
            var that = this;

            if (httpRequest) {
                httpRequest.then(function(r) {
                    if (ns.request.canProcessResponse(r) === false) {
                        // если ответ обработать нельзя, то удаляем модели из запроса и отклоняем промис
                        ns.request.manager.clean(that.models);
                        that.promise.reject({
                            error: 'CANT_PROCESS',
                            invalid: that.models,
                            valid: []
                        });

                    } else {
                        that.extract(regularRequests, r);
                    }

                }, function(error) {
                    ns.log.error('ns.request.http', error);

                    // уходим в извлечение, чтобы пометить запрос завершенным
                    that.extract(regularRequests, {});
                });
            }

            // Ждем резолва всех моделей и "повторяем" запрос
            // Если какие-то ключи не пришли, они будут перезапрошены.
            Vow.all(all).then(this.start.bind(this));

        } else {
            // у всех моделей есть какой-то статус (ERROR или OK)
            // вызываем чистку менеджера
            ns.request.manager.clean(this.models);

            // сортируем модели на валидные и нет
            var validModels = [];
            var invalidModels = [];

            for (var i = 0, j = this.models.length; i < j; i++) {
                var model = this.models[i];
                if (model.isValid()) {
                    validModels.push(model);
                } else {
                    invalidModels.push(model);
                }
            }

            // если есть невалидные модели
            if (invalidModels.length) {
                this.promise.reject({
                    invalid: invalidModels,
                    valid: validModels
                });

            } else {
                // и резолвим весь ns.request
                this.promise.fulfill(this.models);
            }
        }
    };

    Request.prototype.extract = function(models, response) {
        // response - это объект, чтобы дать возможность напихать туда сервисных данных
        // ответы хендлеров приходят в массиве response.models
        var results = (response && response.models) || [];
        for (var i = 0, l = models.length; i < l; i++) {
            var model = models[i];
            var result = results[i];

            // если модель запрашиваем кто-то другой, то этот ответ игнорируем
            if (model.requestID > this.id) {
                continue;
            }

            ns.request.extractModel(model, result);

            // сообщаем менеджеру о завершении запроса этой модели
            // это не означает, что завершится весь ns.request
            ns.request.manager.done(model);

            model.finishRequest();
        }
    };

    function models2params(models) {
        var params = {};

        for (var i = 0, l = models.length; i < l; i++) {
            var suffix = '.' + i; // Чтобы не путать параметры с одинаковыми именами разных моделей,
                                  // добавляем к именам параметров специальный суффикс.
            var model = models[i];

            //  Добавляем служебный параметр, содержащий id модели, которую мы хотим запросить.
            params[ '_model' + suffix ] = model.id;

            //  Каждая модель прокидывает в params все свои параметры.
            //  При этом к имени параметра добавляется суффикс.
            var mParams = model.getRequestParams();
            for (var name in mParams) {
                params[name + suffix] = mParams[name];
            }

        }

        return params;
    }

    /**
     * Приводит запрашиваемые модели к формату №3 из ns.request.
     * @param {Array} items Массив названией моделей.
     * @param {object} params Параметры моделей.
     * @returns {Array}
     */
    function normalizeItems(items, params) {
        var _items = [];
        for (var i = 0, l = items.length; i < l; i++) {
            _items.push({
                id: items[i],
                params: params
            });
        }

        return _items;
    }

    /**
     * Возвращает promise из model
     * @param {ns.Model} model Модель
     * @returns {Vow.Promise}
     */
    function model2Promise(model) {
        return model.promise;
    }

    /**
     * Приводит аргументы из ns.request к моделям.
     * @param {String|Array|Object} items Массив названий моделей.
     * @param {object} [params] Параметры моделей.
     * @returns {ns.Model[]}
     */
    function items2models(items, params) {
        // приводим к формату №2
        if (typeof items === 'string') {
            items = [ items ];
        }

        // приводим №2 к формату №3
        if (typeof items[0] === 'string') {
            params = params || {};
            items = normalizeItems(items, params);
        }

        var models = [];
        for (var i = 0, l = items.length; i < l; i++) {
            var item = items[i];
            // ns.request( [ ModelInstance ] )
            if (item instanceof ns.Model) {
                models.push(item);

            } else if (item.model && item.model instanceof ns.Model) {
                models.push(item.model);

            } else {
                models.push(ns.Model.get(item.id, item.params));
            }
        }

        return models;
    }

    function models2name(model) {
        return model.id;
    }

})();

/* ../src/ns.request.js end */

    /* ../src/ns.request.manager.js begin */
/**
 * Менеджер запросов ns.request.
 * @description Менеджер регулирует запросы, контроллирует отсутствие дубликатов и перезапросы.
 * @namespace
 */
ns.request.manager = {

    /**
     * @enum {number}
     */
    STATUS: {
        LOADING: 0,
        FAILED: 1,
        DONE: 2
    },

    _keys: {},

    /**
     * Добавляет запрос модели.
     * @param {ns.Model} model Модель.
     * @param {number} requestId ID запроса.
     * @param {Boolean} forced Флаг принудительного запроса.
     * @returns {Boolean|ns.Model} Если true - модель надо запросить, false - ничег не надо делать, ns.Model - дождаться ресолва промиса возвращенной модели.
     */
    add: function(model, requestId, forced) {
        var REQUEST_STATUS = this.STATUS;

        var modelKey = model.key;
        var request = this._keys[modelKey];

        // если уже кто-то запрашивает такой ключ
        if (request) {
            // если кто-то уже запрашивает модель, но сама модель валидна (обычно это бывает при forceRequest)
            // и это не force-запрос
            if (model.isValid() && !forced) {
                // говорим, что запрашивать ее не надо
                return false;
            }

            if (request.status === REQUEST_STATUS.LOADING) {
                if (model.isDo()) {
                    // если do-запрос с статусе loading, то request.model !== model, потому что do-модели не сохраняются
                    // поэтому тут надо вернуть модель из request, резолвить будем ее и ссылаться будем на нее
                    return request.model;

                } else {
                    if (forced) {
                        // Если запрос forced, но модель уже грузится
                        // retries увеличивать не надо
                        // новый promise создавать не надо, чтобы отрезолвить и первый запрос и этот
                        request.model.requestID = requestId;
                        return true;

                    } else {
                        return request.model;
                    }
                }

            } else if (request.status === REQUEST_STATUS.FAILED) {
                if (request.model._canRequest()) {
                    this._createRequest(model, requestId);
                    return true;

                } else {
                    model.status = model.STATUS.ERROR;
                    // убираем этот запрос, он больше не будет запрашиваться
                    this.done(model, true);
                    return false;
                }

            } else {
                // сюда приходят уже запрошенные модели, у которых request.status === DONE
                // может быть два варианта

                if (model.isValid()) {
                    // модель запросилась, данные положились, все хорошо
                    // говорим, что модель запрашивать не надо
                    return false;

                } else {
                    /*
                     Кто-то успел инвалидировать модель.
                     Такое возможно, если этот запрос ждал другого.

                     Например,
                     запрос1: m1, m2
                     запрос2: m1, m3

                     Запрос2 завершился раньше и ждет Запрос1.
                     В это время что-то случается, что приводит к инвалидации m3.
                     Тогда мы попадем в эту ветку и перезапросим модель.
                     */

                    if (model._canRequest()) {
                        // надо ее перезапросить
                        this._createRequest(model, requestId);
                        return true;

                    } else {
                        // модель не валидна, но запрашивать её нельзя - ничего не делаем
                        return false;
                    }
                }
            }

        } else {

            if (model.isValid()) {

                // модель валидна, но запрос форсирован и это не этот же запрос
                // проверка model.requestID !== requestId нужна, чтобы зарезолвить промис после окончания запроса
                // иначе forcedModel будет валида, но будет перезапрашиваться из-за forced === true
                if (forced && model.requestID !== requestId) {
                    this._createRequest(model, requestId);
                    return true;
                }

                // если модель валидна и запрос не форсирован - ничего не деалем
                return false;

            }

            // модель не валидна, но запрашивать её нельзя - ничего не делаем
            if (!model.canRequest()) {
                return false;
            }

            // модель не валидна и её можно запросить - надо запросить
            this._createRequest(model, requestId);
            return true;
        }
    },

    /**
     * Выставляет статус запроса модели в завимости от результата.
     * @param {ns.Model} model Модель
     * @param {Boolean} [force=false] Принудительно выставить DONE.
     */
    done: function(model, force) {
        var request = this._keys[model.key];
        // хотя такого не может быть, но вдруг его нет
        if (request) {
            if (model.isValid() || force) {
                request.status = this.STATUS.DONE;

            } else {
                request.status = this.STATUS.FAILED;
            }
        }
    },

    /**
     * Удаляет модель из запросов. Вызывается после завершения ns.request.model.
     * @param {ns.Model[]} models Массив запрашиваемых моделей.
     */
    clean: function(models) {
        for (var i = 0, j = models.length; i < j; i++) {
            var model = models[i];

            // обнуляем попытки после завершения запроса
            model.retries = 0;
            // удаляем модель из списка запрашиваемых
            delete this._keys[model.key];
        }
    },

    /**
     * Записывает информацию о запросе.
     * @param {ns.Model} model Запрашиваемая модель.
     * @param {number} requestId ID запроса.
     * @private
     */
    _createRequest: function(model, requestId) {
        // модель надо запросить
        this._keys[model.key] = {
            status: this.STATUS.LOADING,
            model: model
        };
        model.prepareRequest(requestId);
    }
};

/* ../src/ns.request.manager.js end */

    /* ../src/ns.router.js begin */
/**
 * Find best page for url.
 * @namespace
 * @param {string} url
 * @returns {ns.router~route}
 * @tutorial ns.router
 */
ns.router = function(url) {
    var baseDir = ns.router.baseDir;
    var routesDef = ns.router._routes;

    if ( url.indexOf(baseDir) !== 0) {
        // Ничего подходящего не нашли.
        return {
            page: ns.R.NOT_APP_URL,
            params: {},
            redirect: url
        };
    }

    // Откусываем префикс урла
    url = url.substring(baseDir.length);

    // empty url consider as app root ("/")
    if (!url) {
        url = '/';
    }

    var pathRedirect = ns.router._processRedirect(routesDef.redirect, url);
    if (pathRedirect) {
        return {
            page: ns.R.REDIRECT,
            params: {},
            // add baseDir for redirect url
            // so I define redirect "/" -> "/main", but real url is "/basepath/" -> "/basepath/main"
            redirect: baseDir + pathRedirect
        };
    }

    var urlChunks = url.split('?');
    // /path/?foo=bar -> /path/
    var urlWithoutQuery = urlChunks.shift();

    if (urlWithoutQuery in routesDef.rewriteUrl) {
        var urlQuery = urlChunks.join('?');
        // rewrite url and add query
        url = routesDef.rewriteUrl[urlWithoutQuery] + (urlQuery ? '?' + urlQuery : '');
    }

    var routes = routesDef.route;
    for (var i = 0, j = routes.length; i < j; i++) {
        var route = routes[i];

        var params = ns.router._parseUrl(route, url);
        if (params) {
            // реврайты параметров для этой страницы
            if (route.page in routesDef.rewriteParams) {
                params = routesDef.rewriteParams[route.page](params);
            }

            return {
                page: route.page,
                params: params
            };
        }
    }

    // Ничего подходящего не нашли.
    return {
        page: ns.R.NOT_FOUND,
        params: {}
    };
};

/**
 * Энкодит значения параметров.
 * Доступно для переопределения в приложении.
 * @param {string} pValue значение параметра
 * @param {string} [pName] имя параметра
 */
ns.router.encodeParamValue = encodeURIComponent;
/**
 * Декодит значения параметров.
 * Доступно для переопределения в приложении.
 * @param {string} pValue значение параметра
 * @param {string} [pName] имя параметра
 */
ns.router.decodeParamValue = decodeURIComponent;

/**
 * Первый символ урла. Если приложение работает на хешах, то его надо переопределить в #.
 * @type {string}
 * @constant
 */
ns.router.URL_FIRST_SYMBOL = '/';

/**
 * Get params for router from url
 * @param {object} route Compiled route or redirect
 * @param {array} parsedChunks Result from RegExp.exec
 * @returns {object}
 * @private
 */
ns.router._getParamsRouteFromUrl = function(route, parsedChunks) {
    var rparams = route.params;

    var params = {};
    // Вытаскиваем параметры из основной части урла.
    var l = rparams.length;
    var rparam;
    for (var k = 0; k < l; k++) {
        rparam = rparams[k];

        var paramValueFromURL = parsedChunks[k + 1];
        if (paramValueFromURL) {
            // try to decode
            try {
                paramValueFromURL = ns.router.decodeParamValue(paramValueFromURL, rparam.name);
            } catch(e) {
                // fallback to default value
                paramValueFromURL = '';
            }
        }

        if (!paramValueFromURL) {
            paramValueFromURL = rparam.default_value;
        }

        params[rparam.name] = paramValueFromURL;
    }
    return params;
};

/**
 * Парсит урл согласно маршруту.
 * @param {object} route Маршрут.
 * @param {string} url Обрабатываемый урл.
 * @returns {object|null} Разобранный объект с параметрами или null
 * @private
 */
ns.router._parseUrl = function(route, url) {
    var parsedChunks = route.regexp.exec(url);
    if (parsedChunks) {
        var params = ns.router._getParamsRouteFromUrl(route, parsedChunks);

        // Смотрим, есть ли дополнительные get-параметры, вида ?param1=value1&param2=value2...
        var query = parsedChunks[route.params.length + 1];
        if (query) {
            no.extend(params, ns.parseQuery(query));
        }

        return params;
    }

    return null;
};

/**
 * Обрабатывает стадию редиректов в маршрутизаторе.
 * @param {array} redirectDefs Массив редиректов.
 * @param {string} url Обрабатываемый урл.
 * @returns {string|null} Урл, куда надо средиректить, или null
 * @private
 */
ns.router._processRedirect = function(redirectDefs, url) {
    var pathRedirect;
    for (var i = 0, j = redirectDefs.length; i < j; i++) {
        var redirect = redirectDefs[i];

        // если обработчик редиректа - функция
        if (typeof redirect.path === 'function') {
            // парсим url
            var parsedParams = ns.router._parseUrl(redirect, url);
            if (parsedParams) {
                // отдаем в обработчик разобранные параметры и обрабатываемый url
                pathRedirect = redirect.path(parsedParams, url);
            }

        } else if (redirect.regexp.test(url)) {
            pathRedirect = redirect.path;
        }

        if (pathRedirect) {
            return pathRedirect;
        }
    }

    return null;
};

/**
 * Inititialize ns.router, compiles defined routes.
 */
ns.router.init = function() {
    var routes = ns.router.routes;

    // Типы параметров (нужны при валидации и при генерации урлов).
    ns.router._regexps = {};
    for (var id in ns.router.regexps) {
        ns.router._regexps[id] = new RegExp('^' + ns.router.regexps[id] + '$');
    }

    var _routes = {};
    _routes.redirect = routes.redirect || {};
    _routes.rewriteUrl = routes.rewriteUrl || {};
    _routes.rewriteParams = routes.rewriteParams || {};

    // FIXME вообще конечно лучше бы route был массивом, потому что нам важен порядок рутов... пока не трогаем )
    var rawRoutes = routes.route || {};

    var compiledRoutes = [];
    var compiledRoutesHash = {};
    for (var route in rawRoutes) {
        var page = rawRoutes[route];
        var compiled = ns.router.compile(route);
        compiled.page = page;
        compiledRoutes.push(compiled);
        compiledRoutesHash[page] = compiledRoutesHash[page] || [];
        compiledRoutesHash[page].push(compiled);
    }
    _routes.route = compiledRoutes;
    _routes.routeHash = compiledRoutesHash;

    var rawRedirects = routes.redirect || {};
    var compiledRedirects = [];
    for (var redirect in rawRedirects) {
        var compiled = ns.router.compile(redirect);
        compiledRedirects.push({
            regexp: compiled.regexp,
            path: rawRedirects[redirect],
            params: compiled.params
        });
    }
    _routes.redirect = compiledRedirects;

    ns.router._routes = _routes;
};

/**
 * Generate url.
 * @param {string} url Relative url.
 * @returns {string} Valid url that takes into consideration baseDir.
 */
ns.router.url = function(url) {
    return (ns.router.baseDir + url) || '/';
};

/**
 * @param {string} id Page (layout) name.
 * @param {object} params Url generation params.
 * @returns {string} Generated url.
 */
ns.router.generateUrl = function(id, params) {
    var url;
    var routes = ns.router._routes.routeHash[id];
    params = params || {};

    ns.assert(routes && routes.length, 'ns.router', "Could not find route with id '%s'!", id);

    for (var i = 0; i < routes.length; i++) {
        url = ns.router._generateUrl(routes[i], params);
        if (url !== null) {
            break;
        }
    }

    ns.assert(url !== null, 'ns.router', "Could not generate url for layout id '%s'!", id);

    return ns.router.url(url);
};

/**
 *
 * @param {object} def
 * @param {object} params
 * @returns {string}
 * @private
 */
ns.router._generateUrl = function(def, params) {
    var url;
    var result = [];
    var query = no.extend({}, params);
    var rewrites = ns.router._routes.rewriteUrl;

    var section;
    var svalue;
    var pvalue;
    var param;

    for (var i = 0; i < def.sections.length; i++) {
        section = def.sections[i];
        svalue = '';

        for (var j = 0; j < section.items.length; j++) {
            param = section.items[j];

            if (!param.name) {
                // Добавляем статический кусок урла как есть.
                svalue += param.default_value;
            } else {
                pvalue = params[param.name];
                var is_param_present = param.name in params;

                // Выставляем дефолтное значение только необязательным параметрам.
                if (param.is_optional && !is_param_present) {
                    pvalue = param.default_value;
                }

                // Если это фильтр, то проверяем точное совпадение.
                if (param.is_filter && pvalue !== param.filter_value) {
                    return null;
                }

                // Обязательный параметр должен быть указан.
                if (!param.is_optional && !is_param_present) {
                    return null;
                }

                // Опциональный параметр не должен попасть в урл, если он не указан явно в params.
                if (param.is_optional && !is_param_present) {
                    continue;
                }

                // Проверка типа.
                if (!ns.router._isParamValid(pvalue, param.type)) {
                    return null;
                }
                svalue += ns.router.encodeParamValue(pvalue, param.name);
                delete query[param.name];
            }
        }

        // Не добавляем пустую секцию, если она опциональна.
        if (!svalue && section.is_optional) {
            continue;
        }

        result.push(svalue);
    }

    url = result.join('/');
    url = (url) ? (ns.router.URL_FIRST_SYMBOL + url) : '';

    // Разворачиваем rewrite правила, чтобы получить красивый урл до rewrite-ов.
    var rewrote = true;
    while (rewrote) {
        rewrote = false;
        for (var srcUrl in rewrites) {
            var rewriteTo = rewrites[srcUrl];
            var rewriteToLength = rewriteTo.length;
            var rewriteFrom = url.substr(0, rewriteToLength);

            // ищем не полное совпадение, а в начале строки,
            // например,
            // реврайт "/shortcut" -> "/page/1"
            // урл "/page/1/subpage/2" должен превратится в "/shortcut/subpage/2"
            if (rewriteFrom === rewriteTo) {
                var nextSymbol = url.charAt(rewriteToLength);
                // следующим за реврайченной строкой должен быть "/", "?" или ничего,
                // чтобы реврайт "/page/1" не реврайтил сгенеренный урл "/page/11"
                if (nextSymbol === '/' || nextSymbol === '?' || !nextSymbol) {
                    url = srcUrl + url.substr(rewriteTo.length);
                    rewrote = true;
                }
            }
        }
    }

    // Дописываем query string по traditional-схеме,
    // где массивы разворачиваются в ?id=1&id=2&id=3
    var queryString = ns.params2query(query);
    return (queryString) ? (url + '?' + queryString) : url;
};

/**
 * Compile route.
 * @param {string} route
 * @returns {object}
 */
ns.router.compile = function(route) {
    // Удаляем слеши в начале и в конце урла.
    route = route.replace(/\/$/, '');
    if (route[0] === ns.router.URL_FIRST_SYMBOL) {
        route = route.substr(1);
    }

    var parts = route.split('/');
    var sections = parts.map(ns.router._parseSection);
    var sregexps = sections.map(ns.router._generateSectionRegexp);

    // смысл это махинации - поставить правильный символ в начале урла
    // все секции генерятся с / в начале
    // поэтому заменяем первый символ на константу
    if (sregexps[0][0] === '/') {
        sregexps[0] = ns.router.URL_FIRST_SYMBOL + sregexps[0].substr(1);
    }
    var regexp = sregexps.join('');

    // Вычленяем только параметры.
    var params = [];
    sections.forEach(function(s) {
        params = params.concat(s.items.filter(function(p) { return !!p.name; }));
    });

    // Добавляем "якоря" ^ и $;
    // Плюс матчим необязательный query-string в конце урла, вида ?param1=value1&param2=value2...
    regexp = '^' + regexp + '\/?(?:\\?(.*))?$';

    return {
        regexp: new RegExp(regexp),
        params: params,
        sections: sections
    };
};

/**
 *
 * @param {string} rawSection
 * @returns {object}
 * @private
 */
ns.router._parseSection = function(rawSection) {
    var curIndex = 0;
    var openBraketIndex = -1;
    var closeBraketIndex = -1;
    var items = [];

    while (true) {
        openBraketIndex = rawSection.indexOf('{', curIndex);
        if (openBraketIndex < 0) {
            break;
        }

        closeBraketIndex = rawSection.indexOf('}', openBraketIndex);

        ns.assert(closeBraketIndex > 0, 'ns.router', 'could not parse parameter in url section: %s', rawSection);

        // Добавляем всё, что до { как константу.
        if (openBraketIndex > curIndex) {
            items.push({
                default_value: rawSection.substr(curIndex, openBraketIndex - curIndex)
            });
        }

        // Дальше идёт переменная.
        items.push(ns.router._parseParam(rawSection.substr(openBraketIndex + 1, closeBraketIndex - openBraketIndex - 1)));

        curIndex = closeBraketIndex + 1;
    }

    // Добавляем оставшуюся часть секции .
    if (curIndex < rawSection.length) {
        items.push({
            default_value: rawSection.substr(curIndex)
        });
    }

    return {
        // Секция опциональна когда все параметры опциональны.
        is_optional: items.length && items.filter(function(p) { return p.is_optional; }).length === items.length,
        items: items
    };
};

/**
 * Парсит декларацию параметра (то, что внутри фигурных скобок).
 * @returns {object}
 * @private
 */
ns.router._parseParam = function(param) {
    var chunks;
    var param_type;
    var param_default;
    var param_is_optional;
    var param_filter_value;
    var param_is_filter = false;
    var paramName;

    chunks = param.split('=');
    // название и тип всегда идут вместе "paramName:paramType"
    var paramNameAndType = chunks[0].split(':');

    paramName = paramNameAndType[0];
    // если тип не указан, то id
    param_type = paramNameAndType[1] || 'id';

    // фильтр "=="
    if (chunks.length === 3) {
        param_is_optional = false;
        param_is_filter = true;
        param_filter_value = chunks[2];

        ns.assert(param_filter_value, 'ns.router', "Parameter '%s' value must be specified", paramName);
        ns.assert(ns.router._isParamValid(param_filter_value, param_type), 'ns.router', "Wrong value for '%s' parameter", paramName);

    } else {
        // если в декларации одно "=", то параметр опциональный
        param_is_optional = chunks.length === 2;
        param_default = chunks[1];
    }

    // section parsed
    return {
        name: paramName,
        type: param_type,
        default_value: param_default,
        is_optional: param_is_optional,
        is_filter: param_is_filter,
        filter_value: param_filter_value
    };
};

/**
 *
 * @param {object} section
 * @returns {string}
 * @private
 */
ns.router._generateSectionRegexp = function(section) {
    var re = '';

    section.items.forEach(function(p) {
        re += ns.router._generateParamRegexp(p);
    });

    if (section.is_optional) {
        re = '(?:/(?!/)' + re + ')?';
    } else {
        re = '/' + re;
    }

    return re;
};

/**
 *
 * @param {object} p
 * @returns {RegExp}
 * @private
 */
ns.router._generateParamRegexp = function(p) {
    var re;
    var regexps = ns.router.regexps;

    // static text
    if (p.default_value && !p.name) {
        return p.default_value;
    }

    // validate parameter type is known (if specified)
    if (p.type) {
        ns.assert((p.type in regexps), 'ns.router', "Could not find regexp for type '%s'!", p.type);
    }

    // parameter with filter (param==value)
    if (p.is_filter && p.filter_value) {
        re = '(' + p.filter_value + ')';

    } else {
        re = regexps[p.type];
        re = '(' + re + ')';

        if (p.is_optional) {
            re = '(?:' + re + ')?';
        }
    }

    return re;
};

/**
 *
 * @param {string} pvalue
 * @param {string} ptype
 * @returns {boolean}
 * @private
 */
ns.router._isParamValid = function(pvalue, ptype) {
    var _regexp = ns.router._regexps[ptype];
    ns.assert(_regexp, 'ns.router', "Could not find regexp for type '%s'!", ptype);
    return _regexp.test(pvalue);
};

/**
 * Устанавливает начальное состояние
 * @private
 */
ns.router._reset = function() {
    /**
     * Базовая часть урла, относительно которой строятся урлы. Без слэша на конце.
     * @type {string}
     */
    this.baseDir = '';

    /**
     * Скомпилированные данные.
     * @type {object}
     * @private
     */
    this._routes = null;

    /**
     * Маршруты.
     * Этот массив должен быть объявлен в проекте.
     * @type {object}
     */
    this.routes = {};

    /**
     * Регулярные выражения для проверки типов параметров.
     * @type {object}
     */
    this.regexps = {
        'id': '[A-Za-z_][A-Za-z0-9_-]*',
        'int': '[0-9]+'
    };
};

ns.router._reset();

/**
 * @typedef {object} ns.router~route
 * @property {string} page Название layout.
 * @property {object} params Параметры паршрута.
 */

/* ../src/ns.router.js end */

    /* ../src/ns.update.js begin */
(function() {

    /**
     * Создает ns.Update
     * @classdesc ns.Update
     * @param {ns.View} view Корневой view.
     * @param {object} layout Layout для этого view, результат от ns.layout.page()
     * @param {object} params Параметры, результат от ns.router()
     * @param {ns.Update~options} [options] Опции исполнения.
     * @constructor
     * @example
     * ```js
     * var route = ns.router('/folder/123/message/456');
     * var layout = ns.layout.page(route.page, route.params);
     * var update = new ns.Update(AppBlock, layout, route.params);
     * update.start();
     * ```
     * @tutorial ns.update
     * @tutorial ns.update.logic
     * @mixes ns.profile
     */
    ns.Update = function(view, layout, params, options) {
        /**
         * Корневой view.
         * @private
         * @type {ns.View}
         */
        this.view = view;

        // ищем layout от view
        if (this.view.id in layout) {
            this.layout = layout[this.view.id];

        } else {
            // если его нет - ругаемся
            throw new Error("[ns.Update] Can't find view layout");
        }

        this.params = params;

        this.id = ++update_id;

        this.promise = new Vow.Promise();

        options = options || {};

        /**
         * Execution flag
         * @type {ns.U.EXEC}
         */
        this.EXEC_FLAG = options.execFlag || ns.U.EXEC.GLOBAL;
        this.parentUpdate = options.parentUpdate;

        this.log('created instance', this, 'with layout', this.layout, 'and params', this.params);

        this.startTimer('full');
        // добавляем родительский таймер, если есть
        if (options.timers) {
            this._profileTimes['__parent'] = options.timers;
        }

        if (!ns.Update._addToQueue(this)) {
            this.abort();
        }
    };

    no.extend(ns.Update.prototype, ns.profile);

    /**
     * Current ns.Updates.
     * @type ns.Update[]
     * @private
     */
    var currentUpdates = [];

    /**
     * Id последнего созданного update-а.
     * @type {number}
     */
    var update_id = -1;

    /**
     * @see ns.U.STATUS
     * @type {ns.U.STATUS}
     */
    ns.Update.prototype.STATUS = ns.U.STATUS;

    /**
     * Порядок событий для View.
     * @type {Array}
     * @private
     */
    ns.Update.prototype._EVENTS_ORDER = ['ns-view-hide', 'ns-view-htmldestroy', 'ns-view-htmlinit', 'ns-view-async', 'ns-view-show', 'ns-view-touch'];

    /**
     * Счетчик количества запросов моделей.
     * @type {number}
     * @private
     */
    ns.Update.prototype._requestCount = 0;

    /**
     * Регистрирует указанное событие, добавляя к нему признаки ns.update
     * @private
     */
    ns.Update.prototype.log = function() {
        if (!ns.DEBUG) {
            return;
        }

        var args = Array.prototype.slice.apply(arguments);
        // Тут приходит оочень большая портянка html-кода, читать ее неудобно и она засоряет консоль.
        // Поэтому оборачиваем в ноду.
        if (args[0] === 'generated html') {
            args[1] = ns.html2node(args[1]);
        }

        ns.log.debug.apply(ns.log,
            ['[ns.Update]', this.id].concat(args)
        );
    };

    /**
     * Запрашивает модели
     * @private
     * @param {array} models
     * @returns {Vow.promise}
     */
    ns.Update.prototype._requestModels = function(models) {
        var timerName = 'requestModels.' + this._requestCount;

        this.startTimer(timerName);
        this.log('started models request', models);

        var allModelsValid = !this._checkModelsInvalid(models);

        if (allModelsValid) {
            this.stopTimer(timerName);
            this.log('received models', models);
            return Vow.fulfill(models);
        }

        var promise = ns.request.models(models);
        promise.always(function() {
            this.stopTimer(timerName);
        }, this);

        return promise
            .then(this._onRequestModelsOK, this._onRequestModelsError, this);
    };

    ns.Update.prototype._onRequestModelsOK = function(models) {
        this.log('received models', models);
        return models;
    };

    ns.Update.prototype._onRequestModelsError = function(err) {
        this.log('failed to receive models', err);

        var error = {
            error: this.STATUS.MODELS,
            expired: this._expired(),
            invalidModels: err.invalid,
            validModels: err.valid
        };

        if (ns.Update.handleError(error, this)) {
            return [].concat(err.invalid, err.valid);

        } else {
            return Vow.reject(error);
        }

    };

    /**
     * Проверка валидности массива моделей.
     * @param {array} models
     * @returns {boolean} true, eсли хотя бы одна модель не валидна
     */
    ns.Update.prototype._checkModelsInvalid = function(models) {
        return (models || []).some(function(model) {
            return !model.isValid();
        });
    };

    /**
     * Проходит по layout и собирает список активных видов.
     * Для этих видов надо запросить модели.
     * @private
     * @returns {ns.Update~updateViews}
     */
    ns.Update.prototype._getActiveViews = function() {
        var timerName = 'collectModels.' + this._requestCount;

        this.startTimer(timerName);

        var views = {
            sync: [],
            async: [],
            // Флаг, что layout остался в неопределенном состоянии
            // Надо запросить модели и пройтись еще раз
            hasPatchLayout: false
        };

        if (!this.view.destroyed) {
            this.view._getRequestViews(views, this.layout, this.params);
        }

        this.stopTimer(timerName);
        this.log('collected incomplete views', views);

        return views;
    };

    /**
     * Запрашивает модели синхронных видов
     * @private
     * @returns {Vow.promise}
     */
    ns.Update.prototype._requestSyncModels = function() {
        var views = this._getActiveViews();
        var models = views2models(views.sync);
        this.log('collected needed models', models);

        return this._requestModels(models).then(function(result) {
            // если есть патченный layout, то идем в рекурсивный перезапрос
            // FIXME: хорошо бы поставить предел на всякий случай
            if (views.hasPatchLayout) {
                if (!this._checkModelsInvalid(result)) {
                    this._requestCount++;
                    return this._requestSyncModels();
                }
            }
        }, null, this);
    };

    /**
     * Запрашивает модели всех видов
     * @private
     * @returns {Vow.Promise}
     */
    ns.Update.prototype._requestAllModels = function() {
        if (this._expired()) {
            return this._rejectWithStatus(this.STATUS.EXPIRED);
        }

        var requestPromise = new Vow.Promise();
        var views = this._getActiveViews();
        var models = views2models(views.sync);
        this.log('collected needed models', models);

        var syncPromise = this._requestModels(models);

        /*
         Каждому async-view передаем главный Promise из Update
         Когда он зарезолвится, вид сам запустит update на себе

         TODO: Возможная оптимизация: в этом месте можно сделать запрос моделей для async-видов без какой-либо реакции на результат.
         Это позволит отрисовать их немного быстрее, потому что в текущем виде они будут ждать полной отрисовки sync-видов.
         Обратная сторона медали - в браузере могут кончиться коннекты :)
         */
        var asyncPromises = views.async.map(function(/** ns.View */view) {
            return view.updateAfter(this.promise, this.params, this);
        }, this);

        syncPromise.then(function(result) {
            // если есть патченный layout, то идем в рекурсивный перезапрос
            // FIXME: хорошо бы поставить предел на всякий случай
            if (views.hasPatchLayout) {
                if (!this._checkModelsInvalid(result)) {
                    this._requestCount++;
                    requestPromise.sync(this._requestAllModels());
                    return;
                }
            }

            requestPromise.fulfill({
                async: asyncPromises
            });

        }, function(e) {
            requestPromise.reject(e);
        }, this);

        return requestPromise;
    };

    /**
     * Рекурсивно на основе layout
     *  1. создаёт экземпляры видов
     *  2. устанавливает видам asyncState
     */
    ns.Update.prototype._applyLayout = function() {
        // FIXME: методы продублированы специально с заделом на будущий рефакторинг
        this._getActiveViews();
    };

    /**
     * Генерирует html недостающих видов
     * @private
     * @returns {Vow.Promise}
     */
    ns.Update.prototype._generateHTML = function() {
        if (this._expired()) {
            return this._rejectWithStatus(this.STATUS.EXPIRED);
        }

        //  TODO: Проверить, что не начался уже более новый апдейт.
        return Vow.fulfill(this._renderUpdateTree());
    };

    ns.Update.prototype._renderUpdateTree = function() {
        this.startTimer('collectViews');

        var tree = {
            'views': {}
        };

        if (!this.view.destroyed) {
            this.view._getUpdateTree(tree);
        }

        this.log('created render tree', tree);
        this.stopTimer('collectViews');

        var html;
        if (!ns.object.isEmpty(tree.views)) {
            this.startTimer('generateHTML');
            html = this.applyTemplate(tree, this.params, this.layout);
            this.log('generated html', html);
            this.stopTimer('generateHTML');
        }

        return html;
    };

    /**
     * Раскладывает html-узлы по видам и триггерит события
     * @param {HTMLElement} node
     * @private
     */
    ns.Update.prototype._insertNodes = function(node) {
        if (this._expired()) {
            return this._rejectWithStatus(this.STATUS.EXPIRED);
        }

        this.startTimer('triggerHideEvents');
        var hideViewEvents = {
            'ns-view-hide': [],
            'ns-view-htmldestroy': []
        };

        if (!this.view.destroyed) {
            this.view.beforeUpdateHTML(hideViewEvents, false);
        }

        this._triggerViewEvents(hideViewEvents);

        var viewEvents = {
            'ns-view-async': [],
            'ns-view-htmlinit': [],
            'ns-view-show': [],
            'ns-view-touch': []
        };

        this.switchTimer('triggerHideEvents', 'insertNodes');

        if (!this.view.destroyed) {
            this.view._updateHTML(node, {toplevel: true}, viewEvents);
        }

        this.switchTimer('insertNodes', 'triggerEvents');

        this._triggerViewEvents(viewEvents);
        this.stopTimer('triggerEvents');

        return Vow.fulfill();
    };

    ns.Update.prototype._triggerViewEvents = function(viewEvents) {
        // таймеры нужно взять один раз
        var perfTimers = this.getTimers();
        for (var i = 0, j = this._EVENTS_ORDER.length; i < j; i++) {
            var event = this._EVENTS_ORDER[i];
            var views = viewEvents[event] || [];
            for (var k = views.length - 1; k >= 0; k--) {
                views[k].trigger(event, this.params, perfTimers);
            }
        }
    };

    /**
     * Обновляет DOM-представление вида.
     * @description Этот метод - комбинация из generateHTML и insertNodes,
     * которые должны отработать синхронно, чтобы избежать различных спецэффектов.
     *
     * Без этого, например, отрендерить можно одно состояние, но обновить DOM не получится,
     * потому что у видов будет уже другое состояние, если что-то поменяется между generateHTML и insertNodes
     * @private
     */
    ns.Update.prototype._updateDOM = function() {
        if (this._expired()) {
            return this._rejectWithStatus(this.STATUS.EXPIRED);
        }

        var html = this._renderUpdateTree();
        this.startTimer('html2node');
        var node = ns.html2node(html || '');
        this.stopTimer('html2node');
        this._insertNodes(node);
    };

    /**
     * Сценарий предзапроса моделей.
     * Запрашивает модели всех невалидных и вновь созданных синхронных видов в layout.
     * По завершению запроса разрешает promise
     * @returns {Vow.promise}
     */
    ns.Update.prototype.prefetch = function() {
        this.log('started `prefetch` scenario');
        this._requestSyncModels().then(this._fulfill, this._reject, this);
        return this.promise;
    };

    /**
     * Сценарий генерации html
     * Запрашивает модели всех невалидных и вновь созданных синхронных видов в layout
     * Геренирует html указанных видов
     * Результат генерации передаётся строкой при разрешении promise
     * @returns {Vow.promise}
     */
    ns.Update.prototype.generateHTML = function() {
        this.log('started `generateHTML` scenario');

        Vow.invoke(this._requestSyncModels.bind(this))
            .then(this._generateHTML, null, this)
            .then(this._fulfill, this._reject, this);

        return this.promise;
    };

    /**
     * Сценарий предварительного рендеринга страницы
     * Итогом его работы являются срендеренные и проинициализированные, но скрытые виды.
     * Используется для ускорения перехода на целевую страницу
     * @returns {Vow.promise}
     */
    ns.Update.prototype.prerender = function() {
        this.log('started `prerender` scenario');
        // TODO: здесь концептуально нужно придумать, как разделить стадию insertNodes
        // на непосредственную вставку узлов и их показ
        ns.todo();
        return this.promise;
    };

    /**
     * Сценарий полного рендеринга страницы
     * @returns {Vow.promise}
     */
    ns.Update.prototype.render = function() {
        if (this._expired()) {
            this._reject({
                error: this.STATUS.EXPIRED
            });

            return this.promise;
        }

        this.log('started `render` scenario');

        // начинаем цепочку с промиса, чтобы ловить ошибки в том числе и из _requestAllModels
        Vow.invoke(this._requestAllModels.bind(this))
            .then(function(result) {
                this._updateDOM();
                this._fulfill(result);
            }, this._reject, this)
            // еще один reject, чтобы ловить ошибки из #_updateDOM
            .then(null, this._reject, this);

        return this.promise;
    };

    /**
     * @see #render
     * @deprecated Надо использовать #render
     * @function
     */
    ns.Update.prototype.start = ns.Update.prototype.render;

    /**
     * Сценарий воссоздания приложения из заранее сформированнного dom-дерева страницы
     * @param {HTMLElement} node
     * @returns {Vow.promise}
     */
    ns.Update.prototype.reconstruct = function(node) {
        this.log('started `reconstruct` scenario');
        this._applyLayout();

        Vow.invoke(this._insertNodes.bind(this), node)
            .then(function() {
                this._fulfill({async: []});
            }, this._reject, this);

        return this.promise;
    };

    /**
     * Рендерит дерево видов.
     * @description
     * Этот метод является точкой расширения в приложении.
     * Если приложение использует yate-модули или другой шаблонизатор,
     * то ему надо переопределить этот метод.
     * @param {object} tree Дерево видов.
     * @param {object} params Параметры страницы.
     * @param {object} layout Раскладка страницы.
     * @returns {HTMLElement}
     */
    ns.Update.prototype.applyTemplate = function(tree, params, layout) {
        /* jshint unused: false */
        return ns.renderString(tree, null, '');
    };

    /**
     * @returns {Boolean} true in case another update was created after current update.
     * @private
     */
    ns.Update.prototype._expired = function() {
        // update считается просроченным, если
        // его промис уже зарезолвили (fulfill или reject)
        // его нет в списке активных update (т.е. его кто-то оттуда убрал)
        return this.promise.isResolved() || currentUpdates.indexOf(this) === -1;
    };

    /**
     * Останавливает процесс обновления
     * @private
     */
    ns.Update.prototype.abort = function() {
        //TODO: Should we abort ns.request?

        // reject promise
        this._reject({
            error: ns.U.STATUS.EXPIRED
        });
    };

    /**
     * @private
     * @param {*} result Result data.
     */
    ns.Update.prototype._fulfill = function(result) {
        if (this.promise.isResolved()) {
            return;
        }

        ns.Update._removeFromQueue(this);
        this.stopTimer('full');
        this.promise.fulfill(result);
        this.perf(this.getTimers());
        this.log('successfully finished scenario');
    };

    /**
     * @private
     * @param {*} reason Error data.
     */
    ns.Update.prototype._reject = function(reason) {
        if (this.promise.isResolved()) {
            return;
        }

        ns.Update._removeFromQueue(this);
        this.stopTimer('full');
        this.promise.reject(reason);
        this.log('scenario was rejected with reason', reason);
    };

    /**
     * Возвращает reject-промис с статусом
     * @param {ns.U.STATUS} status
     * @returns {Vow.Promise}
     * @private
     */
    ns.Update.prototype._rejectWithStatus = function(status) {
        return Vow.reject({
            error: status
        });
    };

    /**
     * Whether this update is a global update (main update) or not.
     * @returns Boolean.
     */
    ns.Update.prototype.isGlobal = function() {
        return this.EXEC_FLAG === ns.U.EXEC.GLOBAL;
    };

    /**
     * В метод приходят данные профилировщика.
     * @description
     * Этот метод является точкой расширения в приложении.
     * Например, можно логировать долгую работу ns.Update, когда общее время превыщает предел.
     * @param {ns.Update~PerformanceTimings} perf
     */
    ns.Update.prototype.perf = function(perf) {
        /* jshint unused: false */
    };

    /**
     * @typedef {object} ns.Update~PerformanceTimings
     * @property {ns.Update~PerformanceTimings} __parent Таймеры родительского экземпляра. Появляются в случае, если текущий экземпляр обновляет async-вид.
     * @property {number} full Общее время работы. Считается отдельно и не является суммой метрик.
     * @property {number} collectModels Время подготовки запроса.
     * @property {number} requestModels Время запроса данных.
     * @property {number} collectViews Время подготовки дерева шаблонизации.
     * @property {number} generateHTML Время шаблонизации.
     * @property {number} html2node Время преобразования HTML-строки в DOM.
     * @property {number} triggerHideEvents Время выполнения событий "вид скрылся" в видах.
     * @property {number} insertNodes Время обновления DOM.
     * @property {number} triggerEvents Время выполнения событий в видах.
     */

    /**
     * Global error handler.
     * @param {object} error Error summary object `{ error: string, models: Array.<ns.Model> }`.
     * @param {ns.Update} update Update instance so that we can abort it if we want to.
     * @returns Boolean If `true` - update can continue, otherwise update cannot continue.
     */
    ns.Update.handleError = function(error, update) {
        /* jshint unused: false */
        return false;
    };

    function views2models(views) {
        var added = {};
        var models = [];

        for (var i = 0, l = views.length; i < l; i++) {
            var viewModels = views[i].models;
            for (var model_id in viewModels) {
                var model = viewModels[model_id];
                var key = model.key;
                if ( !added[key] ) {
                    models.push(model);
                    added[key] = true;
                }
            }
        }

        return models;
    }

    /**
     * Removes ns.Update instance from queue
     */
    ns.Update._removeFromQueue = function(updateInstance) {
        var index = currentUpdates.indexOf(updateInstance);
        if (index > -1) {
            currentUpdates.splice(index, 1);
        }
    };

    /**
     * Check whether it is possible to execute given ns.Update
     * @description
     * ns.Update can be global, async or parallel.
     * Cases:
     *   - Global update can be terminated by another global Update only.
     *   - Global Update terminated all Updates except parallel.
     *   - Async updates execute simultaneously.
     *   - Parallel update can't be terminated.
     * @static
     *
     * @param {ns.Update} newUpdate New instance of ns.Update.
     * @returns Boolean
     */
    ns.Update._addToQueue = function(newUpdate) {
        var currentRuns = currentUpdates;
        var FLAGS = ns.U.EXEC;
        var FLAG_GLOBAL = FLAGS.GLOBAL;
        var FLAG_ASYNC = FLAGS.ASYNC;

        var newRunExecutionFlag = newUpdate.EXEC_FLAG;
        var i;
        var j;

        // if newUpdate is global we should terminate all non-parallel updates
        if (newRunExecutionFlag === FLAG_GLOBAL) {
            var survivedRuns = [];

            // прекращаем текущие runs
            // ищем с конца, потому что раны могут удаляться
            for (i = currentRuns.length - 1; i >= 0; i--) {
                /**
                 * @type {ns.Update}
                 */
                var run = currentRuns[i];

                // don't terminated paraller updates
                if (isInParallelUpdate(run)) {
                    survivedRuns.push(run);

                } else {
                    run.abort();
                }
            }
            // save survived updates
            currentUpdates = survivedRuns;

        } else if (newRunExecutionFlag === FLAG_ASYNC) { // async update
            if (!isInParallelUpdate(newUpdate)) {
                // check whether we have one global update
                for (i = 0, j = currentRuns.length; i < j; i++) {
                    if (currentRuns[i].EXEC_FLAG === FLAG_GLOBAL) {
                        return false;
                    }
                }
            }
        }

        currentUpdates.push(newUpdate);

        return true;
    };

    /**
     * Опции исполнения.
     * @typedef {object} ns.Update~options
     * @property {ns.U.EXEC} [execFlag=ns.U.EXEC.GLOBAL] Флаг выполнения.
     * @property {ns.Update~PerformanceTimings} [timers] Тайминги родительского ns.Update.
     */

    /**
     * Список обновляемых видов
     * @typedef {object} ns.Update~updateViews
     * @property {ns.View[]} sync Массив видов, которые надо обновить синхронно.
     * @property {ns.View[]} async Массив видов, которые надо обновить асинхронно.
     * @property {boolean} hasPatchLayout Флаг, что в дереве есть неопределившиеся виды.
     */

     /**
      * Обновление является параллельным, либо запущено из параллельного.
      * @param {ns.Update} update
      * @returns {boolean}
      */
     function isInParallelUpdate(update) {
         if (update.parentUpdate) {
             return isInParallelUpdate(update.parentUpdate);
         }

         return update.EXEC_FLAG === ns.U.EXEC.PARALLEL;
     }
})();

/* ../src/ns.update.js end */

    /* ../src/ns.view.js begin */
(function() {

    var uniqueViewId = 0;

    /**
     * Закешированная регулярка для поиска __uniqueId
     * @type {RegExp}
     */
    var RE_UNIQ_VIEW_ID = /ns-view-id-\d+/;

    /**
     * Создает View. Конструктор не используется напрямую, View создаются через ns.View.create.
     * @classdesc Класс, реализующий View
     * @tutorial ns.view
     * @tutorial ns.view.yate
     * @constructor
     * @mixes ns.Events
     */
    ns.View = function() {};
    no.extend(ns.View.prototype, ns.Events);

    /**
     * @see ns.V.STATUS
     * @enum {ns.V.STATUS}
     */
    ns.View.prototype.STATUS = ns.V.STATUS;

    /**
     * Закешированный $(document)
     * @type {jQuery}
     * @private
     */
    ns.View.prototype._$document = ('undefined' === typeof document) ? null : $(document);

    /**
     * Закешированный $(window)
     * @type {jQuery}
     * @private
     */
    ns.View.prototype._$window = ('undefined' === typeof window) ? null : $(window);

    /**
     * Уникальный ключ вида
     * @type {string}
     */
    ns.View.prototype.key = null;

    /**
     * Параметры вида.
     * @type {object}
     */
    ns.View.prototype.params = null;

    /**
     * Собственная нода вида
     * @type {HTMLElement}
     */
    ns.View.prototype.node = null;

    /**
     * Собственная нода вида
     * @type {jQuery}
     */
    ns.View.prototype.$node = null;

    /**
     * Дочерние виды
     * @type {object.<string, ns.View>}
     * @private
     */
    ns.View.prototype.views = null;

    /**
     * ID (название) вида
     * @type {string}
     */
    ns.View.prototype.id = null;

    /**
     * Флаг видимости вида.
     * @type {boolean}
     * @private
     */
    ns.View.prototype._visible = false;

    /**
     * Уникальный идентификатор вида
     * @type {string}
     * @private
     */
    ns.View.prototype.__uniqueId = null;

    /**
     * Флаг навешивания обработчиков событий моделей.
     * @type {boolean}
     * @private
     */
    ns.View.prototype.__modelsEventsBinded = false;

    /**
     * Инициализирует экземпляр вида
     * @param {string} id
     * @param {object} params
     * @param {boolean} async
     * @private
     */
    ns.View.prototype._init = function(id, params, async) {
        this.id = id;
        this.__setUniqueId();

        /**
         * Флаг того, что view может быть асинхронным.
         * Факт того, что сейчас view находится в асинхронном состоянии определяется this.status и this.asyncState
         * @type {boolean}
         */
        this.async = async;

        this.info = ns.View.info(id);

        no.extend(this, ns.View.getKeyAndParams(this.id, params || {}, this.info));

        this._initModels();

        /**
         * Save models version to track changes.
         * @type {object}
         * @private
         */
        this._modelsVersions = {};

        this.views = {};

        /**
         * Статус View.
         * @type {ns.V.STATUS}
         * @private
         */
        this.status = this.STATUS.NONE;
        this.destroyed = false;

        this.__customInit();

        // события, которые надо забиндить сразу при создании блока
        this._bindCreateEvents();

        this.trigger('ns-view-init');
    };

    /**
     * Формирует и устанавливает уникальный идентификатор вида
     * @private
     */
    ns.View.prototype.__setUniqueId = function() {
        if (!this.__uniqueId) {
            this.__uniqueId =  'ns-view-id-' + (++uniqueViewId);
        }
    };

    /**
     * Специальная функция - точка расширения, в которой можно дополнить стандартный #_init.
     * @private
     */
    ns.View.prototype.__customInit = no.nop;

    /**
     *
     * @private
     */
    ns.View.prototype._initModels = function() {
        /**
         * Объект с зависимыми моделями
         * @type {object.<string, ns.Model>}
         * @private
         */
        this.models = {};

        /**
         * Обработчики событий моделей
         * @type {object}
         * @private
         */
        this._modelsHandlers = {};

        // Создаём модели или берем их из кэша, если они уже есть
        for (var id in this.info.models) {
            if (!this.models[id]) {
                var model = ns.Model.get(id, this.params);
                this.models[id] = model;
                this._modelsHandlers[model.key] = {};
            }
        }
    };

    /**
     *
     * @param {string} id
     * @returns {ns.View}
     * @private
     */
    ns.View.prototype._getView = function(id) {
        return this.views[id];
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @param {ns.L} type
     * @returns {ns.View}
     * @private
     */
    ns.View.prototype._addView = function(id, params, type) {
        var view = this._getView(id);
        if (!view) {
            if (type === ns.L.BOX) {
                view = new ns.Box(id, params);
            } else {
                view = ns.View.create(id, params, type === ns.L.ASYNC);
            }
            this.views[view.id] = view;
        }
        return view;
    };

    /**
     * Внутренний обработчик htmldestroy
     * @protected
     */
    ns.View.prototype.__onHtmldestroy = function() {
        this._unbindEvents('init');
    };

    /**
     * Обработчик htmlinit
     * @param {array} [events] Массив событий.
     * @protected
     */
    ns.View.prototype._htmlinit = function(events) {
        this._bindEvents('init');
        events.push(this);
    };

    /**
     * Скрывает view
     * @protected
     */
    ns.View.prototype.hideAndUnbindEvents = function() {
        // Скрывать и ставить флаг надо всегда.
        // Например, для асинхронных видов, которые отрендерили в состоянии async,
        // но `_show` для них не выполнялся
        // Это происходит при быстрой навигации по интерфейсу.

        this.__onHide();
    };

    /**
     * Убираем обработчики событие при скрытии/замены ноды.
     * @protected
     */
    ns.View.prototype.__onHide = function() {
        var doUnbindEvents = !this.isLoading() && this._visible === true;

        if (doUnbindEvents) {
            this._unbindEvents('show');
        }

        // Ставим флаг, что вид скрыт
        this._visible = false;
    };

    /**
     * Показывает View
     * @param {array} [events] Массив событий.
     * @protected
     * @returns {boolean}
     */
    ns.View.prototype._show = function(events) {
        if (!this.isLoading() && !this._visible) {
            if (!this.__modelsEventsBinded) {
                // События моделей навешиваются один раз и снимаются только при уничтожении блока
                // События специально навешиваются только после первого показа вида, чтобы избежать различных спецэффектов.
                this.__bindModelsEvents();
            }
            this._bindEvents('show');
            this._visible = true;
            if (events) {
                events.push(this);
            }
            return true;
        }

        return false;
    };

    /**
     * Навешивает обработчики на события моделей вида.
     * @private
     */
    ns.View.prototype.__bindModelsEvents = function() {
        this.__modelsEventsBinded = true;
        var models = this.models;
        for (var idModel in models) {
            var model = models[idModel];
            this.__bindModelEvents(model);
        }
    };

    /**
     * Навешивает обработчики на события модели.
     * @param {ns.Model} model
     * @private
     */
    ns.View.prototype.__bindModelEvents = function(model) {
        var decl = this.info.models[model.id];
        for (var eventName in decl) {
            var handlerName = decl[eventName];
            var handler = this[handlerName] || decl[eventName];
            ns.View.assert('function' === typeof handler, 4, [this.id, handlerName, model.id]);

            // сам keepValid биндить не надо,
            // потому что _invokeModelHandler и так синхронизирует версию
            if (handler === this.keepValid) {
                // заменяем его на пустую функцию
                handler = no.nop;
            }

            this.__bindModelEvent(model, eventName,
                this._invokeModelHandler.bind(this, handler, model)
            );
        }
    };

    /**
     * Вызывает обработчик события модели
     * @param {function} handler
     * @param {ns.Model} model Модель, на которое произошло событие
     * @private
     */
    ns.View.prototype._invokeModelHandler = function(handler, model) {
        // сохраняем версию модели, которая бросила событие
        this._saveModelVersion(model.id);

        // по нашей логики мы всегда делаем вид валидным,
        // если его надо инвалидировать, то это надо делать руками методом 'invalidate'
        return handler.apply(this, Array.prototype.slice.call(arguments, 2));
    };

    /**
     * Подписывает обработчик handler на событие eventName модели Model
     * @param {ns.Model} model
     * @param {string} eventName
     * @param {function} handler
     * @private
     */
    ns.View.prototype.__bindModelEvent = function(model, eventName, handler) {
        model.on(eventName, handler);
        this._modelsHandlers[model.key][eventName] = handler;
    };

    /**
     * Отписывает обработчики событий моделей вида.
     * @private
     */
    ns.View.prototype.__unbindModelsEvents = function() {
        var models = this.models;
        for (var model_id in models) {
            var model = models[model_id];
            this.__unbindModelEvent(model);
        }
    };

    /**
     * Отписывает обработчики событий модели.
     * @param {ns.Model} model
     * @private
     */
    ns.View.prototype.__unbindModelEvent = function(model) {
        var events = this._modelsHandlers[model.key];

        for (var eventName in events) {
            model.off(eventName, events[eventName]);
            delete events[eventName];
        }
    };

    /**
     * Returns function or method from prototype.
     * @param {String|Function} fn Function or method name from prototype.
     * @returns {Function}
     * @private
     */
    ns.View.prototype._prepareCallback = function(fn) {
        if (typeof fn === 'string') {
            var method = this[fn];
            ns.View.assert(!!method, 5, [fn, this.id]);
            return method;
        }

        return fn;
    };

    /**
     * Копирует массив деклараций событий и возвращает такой же массив, но с забинженными на этот инстанс обработчиками.
     * @param {Array} events
     * @param {number} handlerPos Позиция хендлера в массиве.
     * @returns {Array} Копия events c забинженными обработчиками.
     * @private
     */
    ns.View.prototype._bindEventHandlers = function(events, handlerPos) {
        var bindedEvents = [];

        for (var i = 0, j = events.length; i < j; i++) {
            var event = events[i];

            // копируем события из info, чтобы не испортить оригинальные данные
            var eventCopy = [].concat(event);
            eventCopy[handlerPos] = this._prepareCallback(event[handlerPos]).bind(this);

            bindedEvents.push(eventCopy);
        }

        return bindedEvents;
    };

    /**
     * Возващает обработчики событий для View.
     * @param {string} type Тип обработчиков: 'init' или 'show'.
     * @returns {object}
     * @private
     */
    ns.View.prototype._getEvents = function(type) {
        var eventProp = '_' + type + 'Events';

        if (!this[eventProp]) {
            var eventsInfo = this.info[type + 'Events'];
            var nseventsInfo = this.info[type + 'Nsevents'];

            // копируем информацию из info в View и биндим обработчики на этот инстанс
            this[eventProp] = {
                'bind': this._bindEventHandlers(eventsInfo['bind'], 2),
                'delegate': this._bindEventHandlers(eventsInfo['delegate'], 2),

                'nsevents': this._bindEventHandlers(nseventsInfo, 1)
            };
        }
        return this[eventProp];
    };

    /**
     * Регистрирует обработчики событий после создания ноды.
     * @private
     */
    ns.View.prototype._bindEvents = function(type) {
        var $node = this.$node;
        var i;
        var j;
        var event;
        var events = this._getEvents(type);

        var delegateEvents = events['delegate'];
        for (i = 0, j = delegateEvents.length; i < j; i++) {
            event = delegateEvents[i];

            if (event[1] === 'window' || event[1] === 'document') {
                // this._$window
                // this._$document
                this['_$' + event[1]].on(event[0], event[2]);

            } else {

                if (event[1]) { //selector
                    $node.on(event[0], event[1], event[2]);
                } else {
                    $node.on(event[0], event[2]);
                }
            }
        }

        var bindEvents = events['bind'];
        for (i = 0, j = bindEvents.length; i < j; i++) {
            event = bindEvents[i];
            $node.find(event[1]).on(event[0], event[2]);
        }

        var nsEvents = events['nsevents'];
        for (i = 0, j = nsEvents.length; i < j; i++) {
            event = nsEvents[i];
            ns.events.on(event[0], event[1]);
        }
    };

    /**
     *
     * @private
     */
    ns.View.prototype._bindCreateEvents = function() {
        for (var i = 0, j = this.info.createEvents.length; i < j; i++) {
            var event = this.info.createEvents[i];
            this.on(event[0], this._prepareCallback(event[1]));
        }
    };

    /**
     * Удаляет обработчики событий перед удалением ноды.
     * @private
     */
    ns.View.prototype._unbindEvents = function(type) {
        var $node = this.$node;
        var i;
        var j;
        var event;

        var events = this._getEvents(type);

        var delegateEvents = events['delegate'];
        for (i = 0, j = delegateEvents.length; i < j; i++) {
            event = delegateEvents[i];

            if (event[1] === 'window' || event[1] === 'document') {
                // this._$window
                // this._$document
                this['_$' + event[1]].off(event[0], event[2]);

            } else {

                if (event[1]) { //selector
                    $node.off(event[0], event[1], event[2]);
                } else {
                    $node.off(event[0], event[2]);
                }
            }
        }

        var bindEvents = events['bind'];
        for (i = 0, j = bindEvents.length; i < j; i++) {
            event = bindEvents[i];
            $node.find(event[1]).off(event[0], event[2]);
        }

        var nsEvents = events['nsevents'];
        for (i = 0, j = nsEvents.length; i < j; i++) {
            event = nsEvents[i];
            ns.events.off(event[0], event[1]);
        }
    };

    /**
     * Инвалидует себя и своих потомков.
     */
    ns.View.prototype.invalidate = function() {
        // рекурсивно инвалидируем себя и потомков
        var views = this._getDescendantsAndSelf();
        for (var i = 0, j = views.length; i < j; i++) {
            var view = views[i];
            // меняем статус только у валидных видов,
            // т.к. есть еще статус NONE
            if (view.status === this.STATUS.OK) {
                view.status = this.STATUS.INVALID;
            }
        }
    };

    /**
     *
     * @returns {boolean}
     */
    ns.View.prototype.isOk = function() {
        return (this.status === this.STATUS.OK);
    };

    /**
     *
     * @returns {boolean}
     */
    ns.View.prototype.isLoading = function() {
        return (this.status === this.STATUS.LOADING);
    };

    /**
     * Returns true if view has status NONE
     * @returns {boolean}
     */
    ns.View.prototype.isNone = function() {
        return (this.status === this.STATUS.NONE);
    };

    /**
     * Возвращает true, если блок валиден.
     * @returns {boolean}
     */
    ns.View.prototype.isValid = function() {
        return this.isOk() && this.isModelsValidWithVersions();
    };

    /**
     * Возвращает true, если блок валиден.
     * @ignore
     * @method
     * @returns {boolean}
     */
    ns.View.prototype.isValidSelf = ns.View.prototype.isValid;

    /**
     *
     * @returns {boolean}
     */
    ns.View.prototype.isValidWithDesc = function() {
        //FIXME: надо привести в порядок всю логику вокруг
        // isValid, isValidSelf, isValidWithDesc
        if (!this.isValid()) {
            return false;
        }

        for (var key in this.views) {
            if (!this.views[key].isValidWithDesc()) {
                return false;
            }
        }
        return true;
    };

    /**
     * Returns true if models are valid and not be updated after last view update.
     * @returns {boolean}
     */
    ns.View.prototype.isModelsValidWithVersions = function() {
        return this.isModelsValid(this._modelsVersions);
    };

    /**
     * Возвращает true, если все модели валидны.
     * @param {object} [modelsVersions] Также проверяем, что кеш модели не свежее переданной версии.
     * @returns {Boolean}
     */
    ns.View.prototype.isModelsValid = function(modelsVersions) {
        var models = this.models;
        for (var id in models) {
            /** @type ns.Model */
            var model = models[id];
            if (
                // модель не валидна
                !model.isValid() ||
                // или у неё уже более новая версия данных
                (modelsVersions && this._getModelVersion(id) > modelsVersions[id])
            ) {
                return false;
            }
        }

        return true;
    };

    /**
     * Возвращает true, если вид сейчас виден на странице.
     * @returns {boolean}
     */
    ns.View.prototype.isVisible = function() {
        return this._visible;
    };

    /**
     * Вызываем callback для всех подблоков.
     * Это плоский метод. Он работает только с подблоками и не уходит рекурсивно вглубь by design.
     * @param {function} callback
     * @private
     */
    ns.View.prototype._apply = function(callback) {
        var views = this.views;
        for (var id in views) {
            callback(views[id], id);
        }
    };

    /**
     * Запоминаем свой кусок раскладки страницы для дальнейших перерисовок (например, async).
     * @param {object} pageLayout
     * @private
     */
    ns.View.prototype._saveLayout = function(pageLayout) {
        // запоминаем свой кусок layout
        this.layout = {};
        this.layout[this.id] = {
            views: pageLayout
        };
    };

    /**
     * Рекурсивно проходимся по дереву блоков (построенному по layout) и выбираем новые блоки или
     * требующие перерисовки. Раскладываем их в две "кучки": sync и async.
     * @param {ns.Update~updateViews} updated Hash for sync and async views.
     * @param {object} pageLayout Currently processing layout.
     * @param {object} updateParams Params.
     * @returns {object}
     * @private
     */
    ns.View.prototype._getRequestViews = function(updated, pageLayout, updateParams) {
        var syncState = this.__evaluateState();
        // Добавляем себя в обновляемые виды
        this.__registerInUpdate(syncState, updated);

        /**
         * Флаг, что можно идти по детям.
         * @type {boolean}
         */
        var canGoFather = false;

        // для асинков не ходим в patchLayout совсем
        if (syncState) {
            canGoFather = true;

            // если еще не нашли patchLayout и у нас есть такая функция
            if (typeof this.patchLayout === 'function') {

                // Не надо патчить layout пока нет всех моделей
                // После того, как модели будут запрошены, мы все равно сюда придем еще раз и получим правильный результат
                if (this.isModelsValid()) {
                    this.__patchLayout(pageLayout, updateParams);

                } else {
                    // т.к. patchLayout всегда что-то возвращает, то не имеет смысла идти по детям,
                    // пока patchLayout не отработал
                    canGoFather = false;

                    // ставим флаг, что у нас есть patchLayout, но моделей нет, поэтому состояние неопределено
                    updated.hasPatchLayout = true;
                }
            }

        }

        var layoutViews = pageLayout.views;
        this._saveLayout(layoutViews);

        // Создаем детей и идем вниз только если находимся в синхронном состоянии
        // Иначе получится странная ситуация,
        // что дети асинхронного вида добавят себя как синхронные и для них будут запрошены модели.
        if (canGoFather) {
            // Создаем подблоки
            for (var view_id in layoutViews) {
                this._addView(view_id, updateParams, layoutViews[view_id].type);
            }

            var parentId = this.id;
            this._apply(function(view, id) {
                var views = layoutViews[id];

                ns.View.assert(!!views, 13, [parentId]);
                view._getRequestViews(updated, views, updateParams);
            });
        }

        return updated;
    };

    /**
     * Производит манипуляции с раскладкой.
     * @param {object} pageLayout
     * @param {object} updateParams
     * @private
     */
    ns.View.prototype.__patchLayout = function(pageLayout, updateParams) {
        // чистим старый layout
        pageLayout.views = {};

        var patchLayoutId = this.patchLayout(updateParams);
        ns.View.assert(!!patchLayoutId, 11);

        // компилим новый layout
        // FIXME: а какие параметры передавать???
        // FIXME: вообще все виды сейчас создаются с updateParams (а не view.params) из той логики,
        // FIXME: что вид-родитель может вообще не иметь параметров, а ребенок может
        var newViewLayout = ns.layout.page(patchLayoutId, updateParams);
        this.__checkPatchLayout(newViewLayout);
        // заменяем внутренности на обновленный layout
        no.extend(pageLayout.views, newViewLayout);
    };

    /**
     * Проверяет результат #patchLayout.
     * @param {object} newLayout
     * @private
     */
    ns.View.prototype.__checkPatchLayout = function(newLayout) {
        for (var viewId in newLayout) {
            ns.View.assert(newLayout[viewId].type === ns.L.BOX, 12);
        }
    };

    /**
     * Вычисляет статус (синхронный или асинхронный), в котором надо рисовать вид.
     * @returns {boolean} true - синхронный, false - асинхронный
     * @private
     */
    ns.View.prototype.__evaluateState = function() {
        /**
         * Флаг, означающий, что view грузится асинхронно.
         * @type {Boolean}
         */
        this.asyncState = false;

        var syncState = true;

        /*
         Логика такая: все виды должны себя ВСЕГДА добавлять.
         Иначе может получиться странная ситуация:
         Есть вид v1, он зависит от модель m1. Он валиден.
         Есть вид v2, он зависит от модели m2. Он невалиден.

         v1 не сообщает себя (и свои модели), а v2 сообщает.
         В ns.request уходят знания только про m2.

         Допустим в процессе запроса m2 кто-то инвалидировал модель m1.
         Про ее необходимость никто не знает,
         соответственно дело нормальным способом дойдет до отрисовки,
         где m1 будет перерисован как error-content
         */

        // вид может быть асинхронным
        if (this.async) {
            // shouldBeSync - специальный флаг, чтобы вид async-вид отрисовался в этом Update,
            // его выставляет #update перед запуском ns.Update
            if (this.shouldBeSync || this.isModelsValid()) {
                // async-вид попадает в отрисовку, если
                // - настал его черед (this.shouldBeSync === true)
                // - имеет валидные модели (this.isModelsValid() === true)
                syncState = true;

            } else {
                // ставим флаг, что вид будет отрисован асинхронно
                this.asyncState = true;
                syncState = false;
            }
        } else {

            if (!this.isValidSelf()) {
                // реинвалидируем дочерние виды,
                // потому что их тоже придется перерисовать вместе с родителем
                this.invalidate();
            }

            // обычный блок добавляем всегда
            syncState = true;
        }

        // сбрасываем флаг, чтобы вид оставался асинхронным
        this.shouldBeSync = false;

        return syncState;
    };

    /**
     * Добавляем себя в обновляемые виды.
     * @param {boolean} syncState Вычисленный статус из #__evaluateState
     * @param {ns.Update~updateViews} updatedViews Обновляемые виды.
     * @private
     */
    ns.View.prototype.__registerInUpdate = function(syncState, updatedViews) {
        if (syncState) {
            updatedViews.sync.push(this);
        } else {
            updatedViews.async.push(this);
        }
    };

    /**
     *  Строим дерево для шаблонизатора.
     *  @description
     *  В tree.views будет дерево блоков, которые нужно сгенерить,
     *  причем на верхнем уровне будут т.н. toplevel-блоки --
     *  это невалидные блоки и выше их все блоки валидны.
     *  В частности, это значит, что если блок невалидный, то он будет перерисован
     *  со всеми своими подблоками.
     *
     *  В tree.models будут все модели, требуемые для этих блоков.
     *  @private
     */
    ns.View.prototype._getUpdateTree = function(tree) {
        if ( !this.isValid() ) {
            tree.views[this.id] = this._getViewTree();
        } else {
            this._apply(function(view) {
                view._getUpdateTree(tree);
            });
        }

        return tree;
    };

    /**
     * Возвращает общее дерево видов.
     * Этот метод используют ns.View, ns.ViewCollection и ns.Box
     * @returns {ns.View~UpdateTree}
     */
    ns.View.prototype._getCommonTree = function() {
        var tree = {
            box: this.info.isBox,
            collection: this.info.isCollection,
            id: this.id,
            key: this.key,
            models: {},
            params: this.params,

            // состояние вида, по сути выбираем моду для отрисовку
            // ok - ns-view-content
            // loading - ns-view-async-content
            // error - ns-view-error-content
            // placeholder - специальная отрисовка
            state: this.asyncState ? 'loading': 'ok',

            // фейковое дерево, чтобы удобно матчится в yate
            tree: {},
            uniqueId: this.__uniqueId,
            views: {}
        };

        // добавляем название view, чтобы можно было писать
        // match .view-name ns-view-content
        tree.tree[this.id] = true;

        return tree;
    };

    /**
     * Возвращает общее дерево для ns.View и ns.ViewCollection.
     * @returns {ns.View~UpdateTree}
     * @private
     */
    ns.View.prototype._getTree = function() {
        var tree = this._getCommonTree();

        // даем возможность приложению или плагинам изменить дерево
        var treeToAppend = this.patchTree(tree);

        // если вернули правда объект, то расширяем его
        if (treeToAppend && typeof treeToAppend === 'object' && !Array.isArray(treeToAppend)) {
            // расширяем переданный объект, чтобы он не перетер внутренние свойства
            tree = no.extend(treeToAppend, tree);
        }

        return tree;
    };

    /**
     * Строим дерево блоков.
     * @returns {ns.View~UpdateTree}
     * @private
     */
    ns.View.prototype._getViewTree = function() {
        var tree = this._getTree();

        // всегда собираем данные, в том числе закешированные модели для async-view
        tree.models = this._getModelsForTree();

        // для асинхронного вида не идем вниз по дереву
        if (tree.state === 'loading') {
            return tree;
        }

        // если у вида невалидные модели, то ставим статус 'error'
        if (this.isModelsValid()) {
            //  Сюда попадают только синхронные блоки.
            tree.views = this._getDescViewTree();

        } else {
            tree.state = 'error';
        }

        return tree;
    };

    /**
     * Дополняет дерево видов.
     * @description
     * Этот метод является точкой расширения для приложений или плагинов.
     * Метод должен вернуть объект, который будет добавлен к дереву.
     * Все свойства, конфликтующие с внутренними, будут перетерты.
     * @example
     * ```js
     * ns.View.prototype.patchTree = function(tree) {
     *     // добавляем в дерево ссылки на экземпляры вида и моделей
     *     return {
     *         instance: {
     *             view: this,
     *             models: this.models
     *         }
     *     };
     * }
     * ```
     * @param {object} tree Дерево наложения.
     * @returns {object}
     * @method
     */
    ns.View.prototype.patchTree = no.nop;

    /**
     * Возвращает деревья для дочерних видов
     * @returns {object.<string, ns.View~UpdateTree>}
     * @private
     */
    ns.View.prototype._getDescViewTree = function() {
        var views = {};
        //  Собираем дерево рекурсивно из подблоков.
        this._apply(function(view, id) {
            views[id] = view._getViewTree();
        });

        return views;
    };

    /**
     * Возвращает декларацию вида для вставки плейсхолдера
     * @returns {ns.View~UpdateTree}
     * @private
     */
    ns.View.prototype._getPlaceholderTree = function() {
        var tree = this._getTree();
        tree.state = 'placeholder';

        if (this.info.isCollection) {
            tree.views = this._getDescViewTree();

        } else {
            this._apply(function(view) {
                view._getUpdateTree(tree);
            });
        }

        return tree;
    };

    /**
     *
     * @returns {*}
     * @private
     */
    ns.View.prototype._getModelsForTree = function() {
        var modelsData = {};

        var models = this.models;
        for (var id in models) {
            /** @type ns.Model */
            var model = models[id];
            modelsData[id] = {};
            if (model.isValid()) {
                // successful model status
                modelsData[id].status = 'ok';
                // structure for convenient matching
                modelsData[id][id] = model.getData();
            } else {
                // insuccessful model status
                modelsData[id].status = 'error';
                // structure for convenient matching
                modelsData[id][id] = model.getError();
            }
        }

        return modelsData;
    };

    /**
     * Returns model.
     * @param {string} id Model ID
     * @returns {ns.Model}
     */
    ns.View.prototype.getModel = function(id) {
        return this.models[id];
    };

    /**
     * Returns data of model.
     * @param {string} id Model ID
     * @param {string} [jpath]
     * @returns {*}
     */
    ns.View.prototype.getModelData = function(id, jpath) {
        var model = this.getModel(id);

        if (jpath) {
            return model.get(jpath);
        }
        return model.getData();
    };

    /**
     * Возвращает массив всех вложенных view, включая себя
     * @param {Array} [views=[]] Начальный массив.
     * @returns {Array}
     * @private
     */
    ns.View.prototype._getDescendantsAndSelf = function(views) {
        views = views || [];
        views.push(this);
        this._apply(function(view) {
            view._getDescendantsAndSelf(views);
        });

        return views;
    };

    /**
     * Set view node
     * @param {HTMLElement} node
     * @protected
     */
    ns.View.prototype._setNode = function(node) {
        var STATUS = this.STATUS;
        if (node) {
            this.node = node;
            this.$node = $(node);

            this.status = this.asyncState ? STATUS.LOADING : STATUS.OK;

        } else {
            this.status = STATUS.NONE;
        }
    };

    /**
     * Ищет элемент для вида по его ключу
     * @param {Element} node
     * @returns {?Element}
     * @private
     */
    ns.View.prototype._extractNodeByKey = function(node) {
        var viewNode = node.querySelector('[data-key="' + this.key + '"]');
        // ноды может не быть, тогда кто-то кинет ошибку
        if (!viewNode) {
            return null;
        }

        // Корректировка className для будущего поиска элемента
        var viewClassName = viewNode.className;
        if (viewClassName.indexOf(this.__uniqueId) === -1) {
            viewNode.className = viewClassName.replace(RE_UNIQ_VIEW_ID, this.__uniqueId);
        }

        return viewNode;
    };

    /**
     * Ищет ноду для вида в отрендеренном DOM.
     * @param {Element} node
     * @returns {?Element} Ноды может не быть, эту ситуацию надо обрабатывать.
     * @private
     */
    ns.View.prototype._extractNode = function(node) {
        // Найдём ноду по классу
        var viewNode = ns.byClass(this.__uniqueId, node)[0];

        // Случай, когда DOM дерево было сформировано из вне
        if (!viewNode || viewNode.getAttribute('data-key') !== this.key) {
            viewNode = this._extractNodeByKey(node);
        }

        return viewNode;
    };

    ns.View.prototype._selfBeforeUpdateHTML = function(events, toHide) {
        if (toHide) {
            // этот вид надо гарантированно спрятать, если он был виден
            var isVisible = this._visible === true && !this.isLoading();
            if (isVisible) {
                events['ns-view-hide'].push(this);
            }
            return;
        }

        var viewWasInvalid = !this.isValidSelf();
        if ( viewWasInvalid ) {
            // если была видимая нода
            if (this.node && !this.isLoading()) {
                if (this._visible === true) {
                    events['ns-view-hide'].push(this);
                }
                events['ns-view-htmldestroy'].push(this);
            }
        }
    };

    /**
     * Собирает события ns-view-hide и ns-view-destroy
     * @param {object} events
     * @param {boolean} toHide Вид надо спрятать, так решил его родитель
     */
    ns.View.prototype.beforeUpdateHTML = function(events, toHide) {
        this._selfBeforeUpdateHTML(events, toHide);

        //  Рекурсивно идем вниз по дереву, если не находимся в async-режиме
        if (!this.asyncState) {
            this._apply(function(view) {
                view.beforeUpdateHTML(events, toHide);
            });
        }
    };

    /**
     * Обновляем (если нужно) ноду блока.
     * @param {HTMLElement} node
     * @param {object} updateOptions
     * @param {object} events
     * @private
     */
    ns.View.prototype._updateHTML = function(node, updateOptions, events) {
        //  FIXME nop@: Велик могучим русский языка!
        //  Падежи не сходятся вообще :(
        //
        // при обработке toplevel-view надо скопировать первоначальные updateOptions
        // инчае, при обновлении параллельных веток дерева, toplevel оказажется только первая
        // и, соответственно, DOM-надо обновиться только у нее
        // {
        //   "my-root-view1": {/* tree 1 */},
        //   "my-root-view2": {/* tree 2 */}
        // }
        var options_next;
        if (updateOptions.toplevel) {
            options_next = no.extend({}, updateOptions);

        } else {
            options_next = updateOptions;
        }

        var viewWasInvalid = !this.isValid();

        var viewNode;
        //  Если блок уже валидный, ничего не делаем, идем ниже по дереву.
        if ( viewWasInvalid ) {
            //  Ищем новую ноду блока.
            viewNode = this._extractNode(node);
            ns.View.assert(!!viewNode, 6, [this.id]);

            //  Обновляем весь блок.
            //  toplevel-блок -- это невалидный блок, выше которого все блоки валидны.
            //  Для таких блоков нужно вставить их ноду в DOM, а все его подблоки
            //  автоматически попадут на нужное место.

            if (updateOptions.toplevel) {
                //  Старая нода показывает место, где должен быть блок.
                //  Если старой ноды нет, то это блок, который вставляется в бокс.

                if (this.node) {
                    ns.replaceNode(this.node, viewNode);
                    options_next.parent_added = true;
                }
                //  Все подблоки ниже уже не toplevel.
                options_next.toplevel = false;
            }

            //  вызываем htmldestory только если нода была заменена
            if (this.node && !this.isLoading()) {
                this.__onHide();
                this.__onHtmldestroy();
            }

            //  новая нода должна в любом случае попасть в DOM
            if (this.node && !updateOptions.parent_added && !options_next.parent_added) {
                ns.replaceNode(this.node, viewNode);
            }

            //  Запоминаем новую ноду.
            this._setNode(viewNode);

            if ( this.isOk() ) {
                this._htmlinit(events['ns-view-htmlinit']);

            } else if (this.isLoading()) {
                // В асинхронном запросе вызываем async для view, которые являются заглушкой.
                events['ns-view-async'].push(this);
            }

            this._saveModelsVersions();
        }

        // Если view валидный, то надо стриггерить ns-view-show и ns-view-touch
        if ( this.isOk() ) {
            // событие show будет вызвано, если у view поменяется this._visible
            this._show(events['ns-view-show']);
            events['ns-view-touch'].push(this);
        }

        //  Т.к. мы, возможно, сделали replaceNode, то внутри node уже может не быть
        //  никаких подблоков. В этом случае, нужно брать viewNode.
        viewNode = viewNode || node;

        //  Рекурсивно идем вниз по дереву, если не находимся в async-режиме
        if (!this.asyncState) {
            this._apply(function(view) {
                view._updateHTML(viewNode, options_next, events);
            });
        }
    };

    /**
     * Safe models versions to track changes.
     * @protected
     */
    ns.View.prototype._saveModelsVersions = function() {
        for (var modelId in this.models) {
            this._saveModelVersion(modelId);
        }
    };

    /**
     * Возвращает версию модели.
     * @param {string} modelId ID модели.
     * @returns {number}
     * @private
     */
    ns.View.prototype._getModelVersion = function(modelId) {
        return this.models[modelId].getVersion();
    };

    /**
     * Safe model version to track changes.
     * @param {string} modelId ID модели
     * @protected
     */
    ns.View.prototype._saveModelVersion = function(modelId) {
        this._modelsVersions[modelId] = this._getModelVersion(modelId);
    };

    /**
     * Оставляет вид валидным после изменения моделей
     * @method
     */
    ns.View.prototype.keepValid = ns.View.prototype._saveModelsVersions;

    /**
     * Запускает собственный ns.Update после завершения promise.
     * @param {Vow.Promise} promise Промис, после которого запустить ns.Update
     * @param {object} params Параметры для запуска ns.Update.
     * @param {ns.Update} updateInstance
     * @returns {Vow.Promise}
     */
    ns.View.prototype.updateAfter = function(promise, params, updateInstance) {
        this._asyncPromise = new Vow.Promise();

        var that = this;
        promise.then(function() {
            that.update(params, {
                parentUpdate: updateInstance,
                timers: updateInstance.getTimers() // тайминги можно снять только после завершения работы
            });
        });

        return this._asyncPromise;
    };

    /**
     * Запускает на себе ns.Update
     * @param {object} [params] Дополнительные параметры. Могут использоваться при ручном запуске.
     * @param {ns.Update~options} [options] Опции исполнения. Если указан execFlag, то запускается ASYNC-обновление.
     * @returns {Vow.Promise}
     */
    ns.View.prototype.update = function(params, options) {
        this.shouldBeSync = true;

        var updateParams = this.params;
        if (params) {
            // если передали собственные параметры, то надо их скопировать
            // собственные параметры удобны при ручном вызове этого метода,
            // если ниже по дереву есть боксы
            updateParams = no.extend({}, this.params, params);
        }

        // если нет layout, то это
        // - элемент коллекции и сюда не приходит _applyLayout
        // - отдельно созданный вид через ns.View.create
        if (!this.layout) {
            // создаем временный layout, чтобы отправить его в update
            var fakeLayoutName = 'ns-temp-layout-for-' + this.id;
            var fakeLayout = {};
            fakeLayout[this.id] = {};
            ns.layout.define(fakeLayoutName, fakeLayout);

            this.layout = ns.layout.page(fakeLayoutName, updateParams);

            // удаляем временный layout
            ns.layout.undefine(fakeLayoutName);
        }

        options = options || {};
        options.execFlag = options.execFlag || ns.U.EXEC.ASYNC;

        var updatePromise = new ns.Update(this, this.layout, updateParams, options).render();

        // у элемента коллекции его нет
        if (this._asyncPromise) {
            this._asyncPromise.sync(updatePromise);
        }

        return updatePromise;
    };

    /**
     * Уничтожает себя и все внутренние виды, удаляет ноду из DOM.
     * Этот вид больше никогда не будет живым, метод используется для очистки памяти.
     */
    ns.View.prototype.destroy = function() {
        this._apply(function(view) {
            view.destroy();
        });

        // кидаем событие после прохода по потомкам, чтобы сохранить принцип событий "снизу вверх"
        /**
         * Вид сейчас будет уничтожен.
         * @event ns.View#ns-view-destroyed
         */
        this.trigger('ns-view-destroyed');

        this.views = {};

        if (this.node && !this.isLoading()) {
            // если блок виден, то скрываем его
            if (this.isVisible()) {
                this.trigger("ns-view-hide");
                this.hideAndUnbindEvents();
            }

            this.trigger("ns-view-htmldestroy");
            this.__onHtmldestroy();
        }

        this.__unbindModelsEvents();

        if (this.node) {
            this.$node
                // события
                .off()
                // данные
                .removeData()
                // удаляем из DOM
                .remove();

            this.node = null;
            this.$node = null;
        }

        this.info = null;
        this.layout = null;
        this.models = null;
        this.params = null;
        this.status = this.STATUS.NONE;
        this.destroyed = true;

        this._modelsHandlers = null;
    };

    var _infos = {};
    var _ctors = {};

    /**
     * Определяет новый View.
     * @description
     * ns.Events представляет из себя объект {"eventDecl1": "handler1", "eventDecl2": "handler2"}.
     * "eventDecl" записывается в виде "eventName [ selector ]".
     * "selector" опционален, если его нет, то события регистрируется на ноду View.
     * "handler" может быть строка (тогда она заменится на метод прототипа) или функция.
     * Все хендлеры биндятся на экземпляр View.
     * Разделение на типы событий происходит автоматически по следующим правилам (в порядке приоритета):
     *   - если selector === "window" || selector == "document", то обработчик регистрируется по событию show
     *   - если eventName === "resize", то обработчик регистрируется по событию show
     *   - если eventName === "scroll", то обработчик регистрируется по событию htmlinit с помощью $viewNode.find(selector).on(eventName, handler)
     *   - иначе обработчик регистрируется по событию htmlinit с помощью $viewNode.on(eventName, selector, handler)
     * @param {string} id Название View.
     * @param {ns.View~declaration} [info] Декларация вида.
     * @param {Function|String} [base=ns.View] Базовый View для наследования
     * @returns {Function} Созданный View.
     */
    ns.View.define = function(id, info, base) {
        ns.View.assert(!(id in _infos), 1, [id]);

        info = info || {};

        var baseClass = this;
        if (typeof base === 'string') {
            // если указана строка, то берем декларацию ns.View
            baseClass = _ctors[base];
            ns.View.assert(!!baseClass, 2, [base, id]);

        } else if (typeof base === 'function') {
            baseClass = base;
        }

        var ctor = info.ctor || function() {};
        // Нужно унаследоваться от ns.View и добавить в прототип info.methods.
        ctor = no.inherit(ctor, baseClass, info.methods);

        info.models = this._formatModelsDecl( info.models || {} );
        info.events = info.events || {};

        info.isBox = false;
        info.isCollection = false;

        /**
         * Флаг, что info уже подготовили
         * @type {boolean}
         */
        info.ready = false;

        // часть дополнительной обработки производится в ns.View.info
        // т.о. получаем lazy-определение

        _infos[id] = info;
        _ctors[id] = ctor;

        return ctor;
    };

    /**
     * Устанавливает виды в начальное состояние
     * @private
     */
    ns.View._reset = function() {
        _ctors = {};
        _infos = {};
    };

    /**
     * Возвращает сохраненную декларацию ns.View без обработки.
     * @param {string} id Название вида.
     * @returns {ns.View~declaration}
     * @throws Бросает исключения, если вид не определен
     */
    ns.View.infoLite = function(id) {
        var info = _infos[id];
        ns.View.assert(!!info, 3, [id]);
        return info;
    };

    /**
     * Возвращает обработанную информацию о View.
     * @param {string} id Название вида.
     * @returns {ns.View~declaration}
     * @throws Бросает исключения, если вид не определен
     */
    ns.View.info = function(id) {
        var info = ns.View.infoLite(id);
        if (!info.ready) {
            ns.View._initInfoParams(info);
            ns.View._initInfoEvents(info);

            info.ready = true;
        }
        return info;
    };

    /**
     *
     * @param {ns.View~declaration} info
     * @private
     */
    ns.View._initInfoParams = function(info) {
        if (info.params) {
            ns.View.assert(!info['params+'], 7);
            ns.View.assert(!info['params-'], 8);

            // если ключ вычисляет функция, то не надо вычислять группы
            if (typeof info.params === 'function') {
                info.pGroups = [];
                return;
            }

            var groups;
            var pGroups = [];
            if ( !Array.isArray(info.params) ) {
                groups = [ info.params ];
            } else {
                groups = info.params;
            }

            for (var i = 0; i < groups.length; i++) {
                var group = groups[i];
                // Если в params задано значение параметра -- это фильтр.
                // Опциональные параметры view это параметры моделей с дефолтным значением.
                // Опциональные параметры есть только когда параметры view формируются из параметров моделей (смотри ниже).
                pGroups.push({
                    pNames: Object.keys(group),
                    pFilters: group,
                    pDefaults: {}
                });
            }

            info.pGroups = pGroups;

        } else {
            var params = {};
            for (var model_id in info.models) {
                var modelInfo = ns.Model.info(model_id);
                ns.View.assert(!!modelInfo, 9, [model_id]);

                if (typeof modelInfo.params === 'object') {
                    no.extend( params, modelInfo.params );
                }
            }

            //  Массив с параметрами, которые надо исключить из ключа.
            var exclude = info['params-'];
            if (exclude) {
                for (var i = 0; i < exclude.length; i++) {
                    delete params[ exclude[i] ];
                }

                delete info['params-'];
            }

            //  Дополнительные параметры (расширяют параметры от моделей или перекрывают их).
            if (info['params+']) {
                no.extend( params, info['params+'] );
                delete info['params+'];
            }

            // Когда параметры строятся из параметров моделей нет фильтров параметров.
            // И групп параметров - всего одна.
            var pNames = Object.keys(params);
            if (pNames.length) {
                info.pGroups = [
                    {
                        pNames: pNames,
                        pFilters: {},
                        pDefaults: params
                    }
                ];
            } else {
                info.pGroups = [];
            }
        }
    };

    /**
     *
     * @param {ns.View~declaration} info
     * @private
     */
    ns.View._initInfoEvents = function(info) {
        /**
         * События, которые надо повесить сразу при создании view
         * @type {Array}
         */
        info.createEvents = [];

        /**
         * События, которые вешаются на htmlinit, снимаются на htmldestroy
         * @type {object}
         */
        info.initEvents = {
            'bind': [],
            'delegate': []
        };

        /**
         * События, которые вешаются на show, снимаются на hide
         * @type {object}
         */
        info.showEvents = {
            'bind': [],
            'delegate': []
        };

        /**
         * Декларации подписок на кастомные события при создании View.
         * @type {object}
         */
        info.initNsevents = [];

        /**
         * Декларации подписок на кастомные события при показе View.
         * @type {object}
         */
        info.showNsevents = [];

        // парсим события View
        for (var eventDecl in info.events) {
            var declParts = eventDecl.split(' ');

            // первый элемент - событие
            var eventParts = declParts.shift().split('@');
            var when = eventParts.length > 1 ? eventParts.pop() : '';
            // нормализуем when
            when = when && (when === 'init' || when === 'show') ? when : '';

            var eventName = eventParts.join('@');

            // остальное - селектор
            var eventSelector = declParts.join(' ');

            if (eventName) {
                var handler = info.events[eventDecl];
                var nativeEvent = ns.V.DOM_EVENTS.indexOf(eventName) > -1;

                if (nativeEvent) {
                    var arr = [eventName, eventSelector, info.events[eventDecl]];

                    // глобальные селекторы всегда delegate
                    var globalSelector = eventSelector === 'window' || eventSelector === 'document';
                    // все события вешаем через .on(event, selector), кроме scroll, который .find(selector).on(scroll, handler)
                    var delegatedEvent = globalSelector || !(eventName === 'scroll' && eventSelector);

                    if (!when) {
                        when = globalSelector ? 'show' : 'init';
                    }

                    // info.initEvents.delegate.push(arr)
                    info[when + 'Events'][delegatedEvent ? 'delegate' : 'bind'].push(arr);

                } else {
                    // все ns-view* события вешаются при создании вида и не снимаются никогда
                    // TODO возможна утечка памяти (но она была и раньше, когда вешались так только ns-view-init и ns-view-async)
                    if (ns.V.NS_EVENTS.indexOf(eventName) > -1) {
                        info.createEvents.push([eventName, handler]);

                    } else {
                        /*
                        Кастомные ("космические") события через общую шину (ns.events) по умолчанию вешаются на show и снимаются на hide.

                        Логика такая:
                        На странице может быть много экземпляров одного вида и каждый из них отреагирует, если будет init.
                        Но кастомные события создавались для общения вида с внешним миром, и обычно реагировать должны только видимые виды.
                        Опять же инициатором такого события (в большинстве случаев) будет действие пользователя, а обработчики DOM-событий вешаются на show.
                         */

                        when = when || 'show';
                        info[when + 'Nsevents'].push([eventName, handler]);
                    }
                }
            }
        }
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @param {object} [info]
     * @returns {string}
     */
    ns.View.getKey = function(id, params, info) {
        return this.getKeyAndParams(id, params, info).key;
    };

    /**
     * Возвращает ключ объекта и параметры.
     * В этом методе собрана вся логика рерайтов параметров при создании view
     * @returns {object}
     */
    ns.View.getKeyAndParams = function(id, params, info) {
        //  Ключ можно вычислить даже для неопределенных view,
        //  в частности, для боксов.
        info = info || ns.View.info(id) || {};

        var keyParams;
        if ('function' === typeof info.params) {
            // передаем копию параметров, т.к. их сейчас будут менять
            keyParams = info.params(no.extend({}, params));
        } else {
            keyParams = ns.View._getKeyParams(id, params, info);
        }

        // динамическая доработа параметров напильником
        if ('function' === typeof info.paramsRewrite) {
            keyParams = info.paramsRewrite(keyParams);
        }

        ns.View.assert(!!keyParams, 10, [id]);

        return {
            params: keyParams,
            key: ns.key('view=' + id, keyParams)
        };
    };

    /**
     *
     * @param {string} id
     * @param {object} params
     * @param {ns.View~declaration} info
     * @returns {*}
     * @private
     */
    ns.View._getKeyParams = function(id, params, info) {
        var extendedModels = {};
        var paramsExtendedByModels = false;
        // расширяем params параметрами из моделей, у которых info.params - функция
        for (var model in info.models) {
            var modelInfo = ns.Model.info(model);
            if (typeof modelInfo.params === 'function') {
                paramsExtendedByModels = true;
                no.extend(extendedModels, modelInfo.params(params));
            }
        }

        if (paramsExtendedByModels) {
            // расширяем оригинальными params, чтобы они все перетерли
            no.extend(extendedModels, params);
            params = extendedModels;
        }

        var pGroups = info.pGroups || [];

        // Группы параметров могут быть не заданы (это ок).
        if (!pGroups.length) {
            // если нет собственных групп, но есть параметры модели, то надо брать их
            if (paramsExtendedByModels) {
                return params;
            }
            return {};
        }

        for (var g = 0; g < pGroups.length; g++) {
            var group = pGroups[g];
            var pNames = group.pNames || [];
            var pFilters = group.pFilters || {};
            var pDefaults = group.pDefaults || {};
            var result = {};

            for (var i = 0, l = pNames.length; i < l; i++) {
                var pName = pNames[i];
                var pValue = params[pName];
                var pFilter = pFilters[pName];
                var isOptional = pName in pDefaults;

                pValue = (pValue === undefined) ? pDefaults[pName] : pValue;

                if (pValue == null && isOptional) {
                    continue;
                }

                if (pValue == null || (pFilter && pValue !== pFilter)) {
                    result = null;
                    break;
                }

                result[pName] = pValue;
            }

            if (result) {
                return result;
            }
        }

        return null;
    };

    /**
     * Фабрика ns.View
     * @param {string} id ID view.
     * @param {object} [params] Параметры view.
     * @param {Boolean} [async=false] Может ли view бы асинхронным.
     * @returns {ns.View}
     */
    ns.View.create = function(id, params, async) {
        var Ctor = _ctors[id];
        ns.View.assert(!!Ctor, 3, [id]);

        /**
         * @type {ns.View}
         */
        var view = new Ctor();
        view._init(id, params, async);

        return view;
    };

    /**
     * Ассертер.
     * @param {boolean} truthy Любое значение, которое проверяется на истинность.
     * @param {ns.View.ERROR_CODES} errorCode Код бросаемого исключения.
     * @param {array} [args] Массив аргументов.
     */
    ns.View.assert = function(truthy, errorCode, args) {
        if (truthy) {
            return;
        }

        args = Array.isArray(args) ? args : [];

        var logArgs = [
            'ns.View',
            ns.View.ERROR_CODES[errorCode]
        ].concat(args);

        ns.assert.fail.apply(ns, logArgs);
    };

    /**
     * Объект с описанием бросаемых исключений.
     * @enum {number}
     */
    ns.View.ERROR_CODES = {
        1: "Can't redefine '%s'",
        2: "Can't find '%s' to extend '%s'",
        3: "'%s' is not defined",

        /**
         * Не найден обработчик события модели.
         */
        4: "'%s' can't find handler '%s' for model '%s'",

        /**
         * Не найден обработчик события.
         */
        5: "Can't find method '%s' in '%s'",

        /**
         * Не найдена нода вида.
         */
        6: "Can't find node for '%s'",

        7: 'you cannot specify params and params+ at the same time',
        8: 'you cannot specify params and params- at the same time',
        9: 'Model %s is not defined!',
        10: 'Could not generate key for view %s',
        11: '#patchLayout MUST returns valid layout ID',
        12: '#patchLayout MUST returns layout with ns.Box at top',
        13: 'You cannot change children inside of a regular view. Maybe "%s" should be ns.Box.'
    };

    /**
     * События моделей, обрабатываемые видом по умолчанию
     */
    ns.View.defaultModelEvents = {
        'ns-model-insert': 'invalidate',
        'ns-model-remove': 'invalidate',
        'ns-model-changed': 'invalidate',
        'ns-model-destroyed': 'invalidate'
    };

    /**
     * Преобразует декларацию в виде массива ['model1', 'model2', ...]
     * в объект {model1: 'handlerDefault1', model2: 'handlerDefault2', ...}
     * @param {array} decl
     * @return {object}
     * @private
     */
    ns.View._expandModelsDecl = function(decl) {
        if (!Array.isArray(decl)) {
            return decl;
        }

        var declExpanded = {};

        for (var i = 0, l = decl.length; i < l; i++) {
            declExpanded[decl[i]] = no.extend({}, this.defaultModelEvents);
        }

        return declExpanded;
    };

    /**
     * Преобразует разные варианты деклараций подписки на события модели
     * в единый расширенный формат
     *
     * @param {object[]} decls
     * @returns {{}}
     * @private
     */
    ns.View._formatModelsDecl = function(decls) {
        var declsFormated = this._expandModelsDecl(decls);

        // Разрвернём краткий вариант декларации в полный
        for (var idModel in declsFormated) {
            var declFull = getFullMethodDecl(declsFormated[idModel]);

            // общий обработчик для всех событий
            var methodCommon = null;
            if ('string' === typeof declFull) {
                methodCommon = declFull;
                declFull = {};
            }

            // нужно гарантировать подписку на все стандартные события
            for (var eventName in this.defaultModelEvents) {

                // обработчик события по умолчанию
                var methodDefault = this.defaultModelEvents[eventName];

                if (undefined === declFull[eventName]) {
                    // если обработчик события явно не задан,
                    // используем общий обработчик или, если такого нет, обработчик по умолчанию
                    declFull[eventName] = methodCommon || methodDefault;
                } else {
                    // если обработчик явно задан, используем его,
                    // приведя к полному виду
                    declFull[eventName] = getFullMethodDecl(declFull[eventName]);
                }
            }

            declsFormated[idModel] = declFull;
        }

        return declsFormated;
    };

    /**
     * Преобразует краткую декларацию (true|false) обработчика события в полную
     * или возвращает исходную.
     *  - true  -> invalidate
     *  - false -> keepValid
     */
    var getFullMethodDecl = function(decl) {
        if (true === decl) {
            return 'invalidate';
        } else if (false === decl) {
            return 'keepValid';
        }
        return decl;
    };

    /**
     * Дерево для шаблонизации вида.
     * @typedef {object} ns.View~UpdateTree
     * @property {boolean} box - Флаг указывающий, что это бокс.
     * @property {boolean} collection - Флаг указывающий, что это вид-коллекция.
     * @property {string} key - Ключ вида.
     * @property {object.<string, *>} models - Объект с данными моделей. Не стоит использовать его напрямую. Лучше вызывать yate-функции `model('modelName')` и `modelError('modelName')`.
     * @property {object.<string, *>} params - Собственные параметры вида.
     * @property {string} state - Текущее состояние вида. ok/error/loading/placeholder
     * @property {object.<string, ns.View~UpdateTree>} views - Объект с дочерними видами, используется для дальнейшего наложения шаблонов через `ns-view-content`.
     */

    /**
     * Декларация вида
     * @typedef {object} ns.View~declaration
     * @property {Function} [ctor] - Конструтор.
     * @property {object} [methods] - Методы, дополняющие прототип класса.
     * @property {object|array} [models] - Массив или объект с моделями, от которых зависит View. Для объекта: true означает модель должна быть валидной для отрисовки view.
     * @property {object} [events] - События, на которые подписывается View.
     * @property {Function|object|array} [params] - Декларация для вычисления параметров вида.
     * @property {object} [params+] - Объект с дополнительными параметрами для вида.
     * @property {array} [params-] - Массив с параметрами, которые надо убрать из ключа.
     * @property {Function} [paramsRewrite] - Функция, изменяющая параметры после создания стандартными способами.
     */

})();

/* ../src/ns.view.js end */

    /* ../src/ns.viewCollection.js begin */
/**
 * Создает коллекцию видов.
 * @classdesc Коллекция видов.
 * @tutorial ns.viewCollection
 * @augments ns.View
 * @constructor
 */
ns.ViewCollection = function() {};

// скопируем статические методы
no.extend(ns.ViewCollection, ns.View);
// унаследуем прототип
no.inherit(ns.ViewCollection, ns.View);

/**
 *
 * @param {string} id
 * @param {object} info
 * @param {function|string} baseClass
 * @returns {ns.View}
 */
ns.ViewCollection.define = function(id, info, baseClass) {
    info = info || {};

    baseClass = baseClass || this;
    var ctor = ns.View.define.call(this, id, info, baseClass);

    ns.assert(info.split, 'ns.ViewCollection', "'%s'  must define 'split' section", id);

    // TODO: test
    ns.assert(!(info.split.intoViews && info.split.intoLayouts), 'ns.ViewCollection', "'%s' can't define 'split.intoViews' and 'split.intoLayouts' sections at same time", id);

    if (typeof info.split.intoViews === 'string') {
        var autogenerateLayoutId = ns.layout.generateSimple(info.split.intoViews, 'ns-auto-layout-' + id);
        delete info.split.intoViews;
        /* jshint -W054 */
        info.split.intoLayouts = new Function('', 'return "' + autogenerateLayoutId + '"');

    } else if (typeof info.split.intoViews === 'function') {
        info.split.intoLayouts = function(model, params) {
            var viewId = info.split.intoViews.call(this, model, params);
            if (viewId) {
                // генерируем динамически layout и возвращаем его
                return ns.layout.generateSimple(viewId, 'ns-auto-layout-' + id);
            }

            return null;
        };
    }

    ns.assert(info.split.intoLayouts, 'ns.ViewCollection', "'%s'  must define 'split.intoLayouts' section", id);
    ns.assert(info.split.byModel, 'ns.ViewCollection', "'%s'  must define 'split.byModel' section", id);

    var isValidModelCollection = (info.split.byModel in info.models) && ns.Model.infoLite(info.split.byModel).isCollection;
    ns.assert(isValidModelCollection, 'ns.ViewCollection', "'%s'  must depend on ns.ModelCollection", id);

    info.isCollection = true;
    info.modelCollectionId = info.split.byModel;

    return ctor;
};

ns.ViewCollection.prototype.__customInit = function() {
    /**
     * Массив видов, которые надо уничтожить на стадии _updateHTML.
     * @type {array}
     * @private
     */
    this.__itemsToRemove = [];

    // эти два хеша нужны, чтобы по modelItem быстро найти его viewItem

    /**
     * Хеш modelItem.key: viewItem
     * @type {object}
     * @private
     */
    this.__model2View = {};

    /**
     * Хеш viewItem.key: modelItem.key
     * @type {object}
     * @private
     */
    this.__view2ModelKey = {};
};

/**
 * События моделей, обрабатываемые видом по умолчанию
 */
ns.ViewCollection.eventsModelCollectionDefault = {
    'ns-model-insert': 'keepValid',
    'ns-model-remove': 'keepValid',
    'ns-model-changed':  'invalidate',
    'ns-model-destroyed': 'invalidate'
};

/**
 * Преобразует декларацию в виде массива ['model1', 'model2', ...]
 * в объект {model1: 'handlerDefault1', model2: 'handlerDefault2', ...}
 * @param {array} decls
 * @return {object}
 * @private
 */
ns.ViewCollection._expandModelsDecl = function(decls) {
    if (!Array.isArray(decls)) {
        return decls;
    }

    var declsExpanded = {};

    for (var i = 0, l = decls.length; i < l; i++) {
        var idModel = decls[i];
        if (ns.Model.infoLite(idModel).isCollection) {
            declsExpanded[idModel] = no.extend({}, this.eventsModelCollectionDefault);
        } else {
            declsExpanded[idModel] = no.extend({}, this.defaultModelEvents);
        }
    }

    return declsExpanded;
};

/**
 * Вызывает обработчик события модели
 */
ns.ViewCollection.prototype._invokeModelHandler = function(handler, model, e, o) {
    // Отфильтруем события вложенных моделей
    if (o && o.model) {
        return;
    }

    this._saveModelVersion(model.id);
    return handler.apply(this, Array.prototype.slice.call(arguments, 2));
};

/**
 * @borrows ns.View.prototype._getModelVersion as ns.ViewCollection.prototype._getModelVersion
 */
ns.ViewCollection.prototype._getModelVersion = function(modelId) {
    var model = this.models[modelId];
    var modelVersion;

    if (modelId === this.info.modelCollectionId) {
        // для зависимой модели-коллекции берем собственную версию,
        // которая не зависит от элементов коллекции
        modelVersion = model.getSelfVersion();

    } else {
        modelVersion = model.getVersion();
    }

    return modelVersion;
};

/**
 * Проходится по всем видам-элементам коллекции в порядке модели-коллекции.
 * @param {function} cb
 */
ns.ViewCollection.prototype.forEachItem = function(cb) {
    // ModelCollection
    var MC = this.models[this.info.modelCollectionId];
    // Какие элементы коллекции рендерить, мы можем понять только по модели
    // Поэтому, полезем внутрь, только если в ней есть данные
    if (MC.isValid()) {
        var modelItems = MC.models;
        // Проходом по элементам MC определим, какие виды нужно срендерить
        for (var i = 0, j = modelItems.length; i < j; i++) {
            var view = this.getItemByModel(modelItems[i]);

            // если нет view, то это значит, что элемент коллекции был отфильтрован
            if (view) {
                cb(view);
            }
        }
    }
};

/**
 * Возвращает вид-элемент коллекции по соответствуещей модели.
 * @param {ns.Model} modelItem
 * @returns {?ns.View} Eсли нет view, то это значит, что элемент коллекции был отфильтрован.
 */
ns.ViewCollection.prototype.getItemByModel = function(modelItem) {
    var modelItemKey = modelItem.key;
    return this.__model2View[modelItemKey];
};

/**
 *
 * @returns {boolean}
 */
ns.ViewCollection.prototype.isValid = function() {
    return this.isValidSelf() && this.isValidDesc();
};

/**
 *
 * @returns {boolean}
 */
ns.ViewCollection.prototype.isValidDesc = function() {
    for (var key in this.views) {
        if (!this.views[key].isValid()) {
            return false;
        }
    }
    return true;
};

/**
 * Делает вид невалидным.
 * @description Cтатус валидности самой коллекции и ее элементов рассчитыается независимо.
 * Поэтому этот метод инвалидирует только себя и оставляет элементы коллекции без изменений.
 */
ns.ViewCollection.prototype.invalidate = function() {
    if (this.status === this.STATUS.OK) {
        // меняем статус только у валидных видов,
        // т.к. есть еще статус NONE
        this.status = this.STATUS.INVALID;
    }
};

/**
 * @borrows ns.View.prototype.invalidate as ns.ViewCollection.prototype.invalidateAll
 */
ns.ViewCollection.prototype.invalidateAll = ns.View.prototype.invalidate;

/**
 *
 * @param {string} id
 * @param {object} params
 * @returns {*}
 * @private
 */
ns.ViewCollection.prototype._getView = function(id, params) {
    var key = ns.View.getKey(id, params);
    return this._getViewByKey(key);
};

/**
 *
 * @param {string} key
 * @returns {ns.View}
 * @private
 */
ns.ViewCollection.prototype._getViewByKey = function(key) {
    return this.views && this.views[key] || null;
};

/**
 *
 * @param {string} id
 * @param {object} params
 * @param {ns.Model} modelItem Элемент коллекции, для которой был создан вид.
 * @returns {ns.View}
 * @private
 */
ns.ViewCollection.prototype._addView = function(id, params, modelItem) {
    var view = this._getView(id, params);
    if (!view) {
        view = ns.View.create(id, params);

        var viewKey = view.key;
        var modelKey = modelItem.key;

        this.views[viewKey] = view;
        this.__model2View[modelKey] = view;
        this.__view2ModelKey[viewKey] = modelKey;
    }

    return view;
};

/**
 *
 * @param {ns.View} view
 * @private
 */
ns.ViewCollection.prototype._deleteView = function(view) {
    var viewKey = view.key;
    var correspondingModelKey = this.__view2ModelKey[viewKey];

    delete this.views[viewKey];
    delete this.__model2View[correspondingModelKey];
    delete this.__view2ModelKey[viewKey];
};

/**
 *
 * @param {function} callback
 * @private
 */
ns.ViewCollection.prototype._apply = function(callback) {
    var views = this.views;
    for (var key in views) {
        callback(views[key], views[key].id);
    }
};

ns.ViewCollection.prototype._getRequestViews = function(updated, layout, updateParams) {
    var pageLayout = layout.views;

    var syncState = this.__evaluateState();
    this.__registerInUpdate(syncState, updated);

    // для асинков не ходим вниз по layout совсем
    if (syncState) {
        //FIXME: копипаста из ns.View

        // ModelCollection
        var MC = this.models[this.info.modelCollectionId];

        // сохраняем активные элементы коллекции, чтобы потом удалить старые
        var activeItems = {};

        // Какие элементы коллекции рендерить, мы можем понять только по модели
        // Поэтому, полезем внутрь, только если в ней есть данные
        if (MC.isValid()) {

            var modelItems = MC.models;
            var infoViewId = this.info.split.intoLayouts;

            var itemsContainer = [];

            // Проходом по элементам MC определим, какие виды нужно срендерить
            for (var i = 0, j = modelItems.length; i < j; i++) {
                var modelItem = modelItems[i];
                var viewItemParams = no.extend({}, updateParams, modelItem.params);

                var viewItemLayout = infoViewId.call(this, modelItem, viewItemParams);

                if (!viewItemLayout) {
                    continue;
                }

                var newViewLayout = ns.layout.page(viewItemLayout, viewItemParams);
                itemsContainer.push(newViewLayout);

                // FIXME: нужен контроль потери детей. Удаление и чистка.
                // Создаем подблоки
                for (var view_id in newViewLayout) {
                    var newView = this._addView(view_id, viewItemParams, modelItem);
                    newView._getRequestViews(updated, newViewLayout[view_id], viewItemParams);

                    activeItems[newView.key] = null;
                }
            }

            pageLayout['ns-view-container'] = itemsContainer;

            // собираем неактивные виды, только когда создали реальное представление
            this.__collectInactiveViews(activeItems);

        } else {
            // ставим флаг, что у нас есть дети, но моделей нет, поэтому состояние неопределено
            updated.hasPatchLayout = true;
        }

    }

    // TODO: вроде бы ничего не мешает не переопределять этот метод и дать возможность коллекции иметь детей
    // Все элементы коллекции в контейнере, а коллекция может иметь собственную разметку, в т.ч. с другими видами

    this._saveLayout(pageLayout);

    // При необходимости добавим текущий вид в список "запрашиваемых"
    return updated;
};

/**
 * Собирает виды старые виды для уничтожения.
 * @param {object} activeItems
 * @private
 */
ns.ViewCollection.prototype.__collectInactiveViews = function(activeItems) {
    var that = this;
    this._apply(function(view) {
        // Если для view нет модели в MC, то нужно его прихлопнуть
        if (!(view.key in activeItems)) {
            // remove from collection
            that._deleteView(view);
            that.__itemsToRemove.push(view);
        }
    });

};

/**
 * Уничтожает старые виды.
 * @private
 */
ns.ViewCollection.prototype.__destroyInactiveViews = function() {
    var views = this.__itemsToRemove;
    for (var i = 0, j = views.length; i < j; i++) {
        views[i].destroy();
    }

    /*
     Почему важно очищать массив тут?

     Массив должен постоянно накапливать виды "на удаление",
     но удалять их не сразу, а вместе с общим обновлением DOM (#_updateHTML).
     Т.о. манипуляции с DOM будут происходит за один тик, а не будут размазаны по времени.

     Еще процесс обновления может прерваться, но вид должен остаться в массиве,
     чтобы его потом не забыть уничтожить.
     */
    this.__itemsToRemove = [];
};

/**
 *
 * @param {object} tree
 * @returns {ns.View~UpdateTree}
 * @private
 */
ns.ViewCollection.prototype._getUpdateTree = function(tree) {
    var decl;
    if (this.isValidSelf()) {
        decl = this._getPlaceholderTree();
    } else {
        decl = this._getViewTree();
    }

    // Добавим декларацию этого ViewCollection в общее дерево
    tree.views[this.id] = decl;

    return tree;
};

/**
 *
 * @returns {object.<string, ns.View~UpdateTree>}
 * @private
 */
ns.ViewCollection.prototype._getDescViewTree = function() {
    var result = {};
    result['ns-view-collection-container'] = [];

    var vcIsValidSelf = this.isValidSelf();

    this.forEachItem(function(view) {
        var decl = null;
        if (vcIsValidSelf) {
            // Если корневая нода не меняется, то перерендериваем
            // только невалидные элементы коллекции
            if (view.info.isCollection && view.isValidSelf()) {
                decl = view._getPlaceholderTree();
            } else if (!view.isValid()) {
                decl = view._getViewTree();
            } else if (!view.isValidWithDesc()) {
                var viewTree = {
                    views: {}
                };
                view._getUpdateTree(viewTree);

                result['ns-view-collection-container'].push(viewTree.views);
                return;
            }
        } else {
            // Если же мы решили перерендеривать корневую ноду, то придётся рендерить все
            // элементы коллекции. Невалидные - полностью, а валидные в виде placeholder'ов
            if (view.isValidSelf()) {
                // если view - обычный вид, то isValidSelf === isValid
                // если view - коллекция, то она проверит себя (isValidSelf) и сделаем дерево для детей
                decl = view._getPlaceholderTree();

            } else {
                decl = view._getViewTree();
            }
        }

        if (decl) {
            /*
             тут создаем специальное дерево, чтобы рендерить разнородные элементы как и обычные виды

             {
             'views': {
             // массив разнородных элементов коллекции
             'ns-view-collection': [
             {
             'view-item-type1': { ... дерево ... }
             },
             {
             'view-item-type2': { ... дерево ... }
             },
             {
             'view-item-type2': { ... дерево ... }
             },
             {
             'view-item-type1': { ... дерево ... }
             }
             ]
             }
             }

             */
            var viewItemTree = {};
            viewItemTree[view.id] = decl;
            result['ns-view-collection-container'].push(viewItemTree);
        }
    });

    return result;
};

/**
 *
 * @param {HTMLElement} node
 * @param {object} updateOptions
 * @param {object} events
 * @private
 */
ns.ViewCollection.prototype._updateHTML = function(node, updateOptions, events) {
    // Для VC нам всегда прийдёт новая нода
    var newNode = this._extractNode(node);
    var isOuterPlaceholder = $(newNode).hasClass('ns-view-placeholder');

    var options_next;
    if (updateOptions.toplevel) {
        options_next = no.extend({}, updateOptions);
    } else {
        options_next = updateOptions;
    }

    if (this.isValidSelf()) {
        // Если не toplevel и placeholder, то нужно взять placeholder (newNode) и заменить его на актуальную ноду (this.node)
        if (!updateOptions.toplevel && isOuterPlaceholder) {
            // Эта ситуация, когда родитель коллекции перерисовался,
            // а эта коллекция рисуется как placeholder
            ns.replaceNode(newNode, this.node);

            // ставим toplevel, чтобы дети себя вставили
            options_next = no.extend({}, updateOptions);
            options_next.toplevel = true;
            options_next.parent_added = true;
        }

    } else {

        var hadOldNode = !!this.node;

        if (!newNode) {
            throw new Error("[ns.ViewCollection] Can't find node for '" + this.id + "'");
        }

        // toplevel-блок -- это невалидный блок, выше которого все блоки валидны.

        // Либо блок toplevel и ему нужно вставить html,
        // либо его html уже вставился за счёт родителя (updateOptions.parent_added)

        if (updateOptions.toplevel) {

            // Если toplevel и placeholder, то не вставляем и в options для вложенных пишем toplevel
            // Если toplevel и не placeholder, то вставляем
            if (isOuterPlaceholder) {
                options_next.toplevel = true;
            } else {
                if (this.node) {
                    ns.replaceNode(this.node, newNode);
                }
                //  Все подблоки ниже уже не toplevel.
                options_next.toplevel = false;
                options_next.parent_added = true;

                this._setNode(newNode);
            }
        } else {
            // Если не toplevel и placeholder, то нужно взять placeholder и заменить его на актуальную ноду
            // Если не toplevel и не placeholder, то ничего не делаем
            if (isOuterPlaceholder) {
                ns.replaceNode(newNode, this.node);

                options_next.toplevel = false;
                options_next.parent_added = true;
            } else {
                this._setNode(newNode);
            }
        }

        if (hadOldNode && !this.isLoading()) {
            this.__onHide();
            this.__onHtmldestroy();
        }

        if ( this.isOk() ) {
            this._htmlinit(events['ns-view-htmlinit']);

        } else if (this.isLoading()) {
            // В асинхронном запросе вызываем async для view, которые являются заглушкой.
            events['ns-view-async'].push(this);
        }
    }

    if ( this.isOk() ) {
        // событие show будет вызвано, если у view поменяется this._visible
        this._show(events['ns-view-show']);
        events['ns-view-touch'].push(this);
        this._saveModelsVersions();
    }

    // Будем обновлять вложенные виды
    // только если это не первая отрисовка async-view
    if (!this.isLoading()) {
        var itemsExist = {};

        // Контейнер потомков.
        var containerDesc = this.__getContainer();

        // Коллекции могут быть вложенны рекурсивно,
        // но плейсхолдер отрисуется только для самых верних,
        // поэтому на всякий случай поставляем сюда свою текущую ноду
        newNode = newNode || this.node;

        var prev;
        // Сначала сделаем добавление новых и обновление изменённых view
        // Порядок следования элементов в MC считаем эталонным и по нему строим элементы VC
        this.forEachItem(function(view) {
            // Здесь возможны следующие ситуации:
            if (isOuterPlaceholder) {
                // 1. html внешнего вида не менялся. Это значит, что вместо корневого html
                // нам пришёл placeholder, содержащий в себе те вложенные виды, которые нужно
                // перерендерить. Поэтому если
                //      1.1 view не валиден, то делаем _updateHtml и вставляем его в правильное
                //          место
                //      1.2 view валиден, то ничего не делаем
                var viewItemWasInValid = !view.isValid();

                // updateHTML надо пройти в любом случае,
                // чтобы у всех элементов коллекции сгенерились правильные события
                view._updateHTML(newNode, options_next, events);

                if (viewItemWasInValid) {
                    // поставим ноду в правильное место
                    if (prev) {
                        // Либо после предыдущего вида
                        $(prev.node).after(view.node);
                        // this.node.insertBefore(view.node, prev.node.nextSibling);
                    } else {
                        // Либо в самом начале, если предыдущего нет (т.е. это первый)
                        $(containerDesc).prepend(view.node);
                    }
                }
            } else {
                // 2. html внешнего вида только что изменился. Это значит, что он вставится в dom
                //    вместе с внутренними видами. Для невалидных там будет новый html, а для
                //    валидных там будет placeholder. Поэтому если
                //      1.1 view не валиден, то он уже занял правильное место в корневом html.
                //          Делаем _updateHtml
                //      1.2 view валиден, то заменим placeholder на правильный html.

                var viewItemWasValid = view.isValid();

                var updateOptionsForPlaceholder = options_next;
                if (viewItemWasValid) {
                    // vc-item отрисовался как placeholder
                    // но внутри него могут быть невалидные виды, они должны сами себя заменить
                    updateOptionsForPlaceholder = no.extend({}, options_next);
                    updateOptionsForPlaceholder.toplevel = true;
                }

                // updateHTML надо пройти в любом случае,
                // чтобы у всех элементов коллекции сгенерились правильные события
                view._updateHTML(newNode, updateOptionsForPlaceholder, events);

                if (viewItemWasValid) {
                    // здесь не нужно перевешивать события, т.к. они могут быть повешены
                    // либо непосредственно на ноду, либо на document. В первом случае
                    // события переедут вместе со старой нодой, а во втором останутся там,
                    // где и были раньше
                    ns.replaceNode(view._extractNode(newNode), view.node);
                }
            }

            itemsExist[view.key] = view;

            prev = view;
        });
    }

    this.__destroyInactiveViews();

    if (!this.isLoading()) {
        // проверяет, что порядок видом соответствует порядку элементов коллекции
        // этот метод нужен для обработки изменения позиции элемента
        this.__sortViewItems();
    }
};

/**
 * Возвращает контейнер для элементов коллекции.
 * @private
 */
ns.ViewCollection.prototype.__getContainer = function() {
    // Контейнер потомков.
    var containerDesc;
    if (ns.hasClass(this.node, 'ns-view-container-desc')) {
        containerDesc = this.node;
    } else {
        containerDesc = ns.byClass('ns-view-container-desc', this.node)[0];
    }

    // Без него нельзя, т.к. если например при предыдущей отрисовке
    // ни один потомок не был отрендерен, а при текущей добавляются новые, непонятно,
    // в какое место их вставлять
    ns.assert(containerDesc, 'ns.ViewCollection', "Can't find descendants container (.ns-view-container-desc element) for '" + this.id + "'");

    return containerDesc;
};

ns.ViewCollection.prototype.__sortViewItems = function() {

    // Контейнер потомков.
    var containerDesc = this.__getContainer();

    // Итератор по HTMLCollection, который возвращает видимые ноды видов.
    var viewNodesIterator = ns.childrenIterator(containerDesc);

    this.forEachItem(function(view) {
        var cursorViewNode = viewNodesIterator.getNext();

        if (cursorViewNode !== view.node) {
            if (cursorViewNode) {
                containerDesc.insertBefore(view.node, cursorViewNode);
            } else {
                containerDesc.appendChild(view.node);
            }
        }
    });
};

/* ../src/ns.viewCollection.js end */


    // ns.box должен подключаться после ns.view, т.к. берет методы из него
    /* ../src/ns.box.js begin */
/**
 * Это внутренний класс, который не должен использоваться приложением.
 * @classdesc Box - это тип View, который умеет выбирать какие View показывать.
 * @param {string} id
 * @param {object} params
 * @constructor
 * @private
 */
ns.Box = function(id, params) {
    this.id = id;
    this.__setUniqueId();
    this.params = params;

    this.views = {};

    // у бокса нет декларации и ключ строить не надо
    this.key = ns.Box.getKey(id);

    this.node = null;

    /**
     * Активные (видимые) в данный момент виды.
     * @private
     * @type {object}
     */
    this.active = {};

    this._visible = false;
    this.destroyed = false;

    this.info = {
        isBox: true,
        isCollection: false
    };
};

/**
 * Возвращает ключ вида
 * @param {string} id Название вида
 * @param {object} params Параметры для ключа
 * @param {ns.L} type Тип
 * @returns {string}
 * @private
 */
ns.Box.prototype._getViewKey = function(id, params, type) {
    var key;
    if (type === ns.L.BOX) {
        key = ns.Box.getKey(id);
    } else {
        key = ns.View.getKey(id, params);
    }

    return key;
};

/**
 *
 * @param {string} id
 * @param {object} params
 * @param {string} type Тип вида.
 * @returns {ns.View}
 * @private
 */
ns.Box.prototype._getView = function(id, params, type) {
    var key = this._getViewKey(id, params, type);
    return this.views[key];
};

/**
 *
 * @param {string} id
 * @param {object} params
 * @param {ns.L} type
 * @returns {ns.View}
 * @private
 */
ns.Box.prototype._addView = function(id, params, type) {
    var view = this._getView(id, params, type);
    if (!view) {
        if (type === ns.L.BOX) {
            view = new ns.Box(id, params);
        } else {
            view = ns.View.create(id, params, type === ns.L.ASYNC);
        }
        this.views[view.key] = view;
    }
    return view;
};

/**
 *
 * @param {array} descs
 * @returns {array}
 * @private
 */
ns.Box.prototype._getDescendantsAndSelf = function(descs) {
    var views = this.views;

    descs.push(this);

    for (var id in views) {
        var view = views[id];
        view._getDescendantsAndSelf(descs);
    }

    return descs;
};

/**
 * Ищем все новые блоки и блоки, требующие перерисовки.
 * @param {object} updated
 * @param {object} layout
 * @param {object} params
 * @private
 */
ns.Box.prototype._getRequestViews = function(updated, layout, params) {
    var layoutViews = layout.views;

    var layoutActive = {};
    for (var id in layoutViews) {
        var childViewLayout = layoutViews[id];
        //  Согласно новому layout'у здесь должен быть view с id/params.
        //  Создаем его (если он уже есть, он возьмется из this.views).
        var view = this._addView(id, params, childViewLayout.type);
        //  Идем вниз рекурсивно.
        view._getRequestViews(updated, childViewLayout, params);

        layoutActive[id] = view.key;
    }

    // сохраняем новый активный layout, в дальнейшем работает с ним
    this.active = layoutActive;
};

/**
 * Боксы всегда валидные, т.е. не toplevel, поэтому просто идем вниз по дереву.
 * @param {object} tree
 * @private
 */
ns.Box.prototype._getUpdateTree = function(tree) {
    if ( this.isNone() ) {
        tree.views[this.id] = this._getViewTree();

    } else {
        for (var id in this.active) {
            var viewKey = this.active[id];
            this.views[viewKey]._getUpdateTree(tree);
        }
    }
};

/**
 * Строим дерево блоков.
 * @returns {object}
 * @private
 */
ns.Box.prototype._getViewTree = function() {
    var tree = this._getCommonTree();

    for (var id in this.active) {
        var viewKey = this.active[id];
        tree.views[id] = this.views[viewKey]._getViewTree();
    }

    return tree;
};

ns.Box.prototype.beforeUpdateHTML = function(events, toHide) {
    for (var viewKey in this.views) {
        //  Достаем ранее созданный блок (в _getRequestViews).
        /** @type {ns.View} */
        var view = this.views[viewKey];
        var toHideView = toHide || (this.active[view.id] !== view.key);

        view.beforeUpdateHTML(events, toHideView);
    }
};

/**
 * Скрываем все неактивные виды в боксе
 * @private
 */
ns.Box.prototype._hideInactiveViews = function() {
    // Пройдёмся по всем вложенным видам, чтобы кинуть hide, которым не попали в newLayout
    for (var key in this.views) {
        var view = this.views[key];
        // Если вид не входит в новый active
        if (this.active[view.id] !== view.key) {

            // Мы проверили большой эксперимент и выяснили,
            // что если не скрывать вьюхи, а детачить их из DOM,
            // то приложение работает быстрее, когда открыто продолжительное время.

            // вид может не быть отрисован,
            // но уже уйти в скрытие
            if (view.node) {
                ns.removeNode(view.node);
            }

            // Скроем виды, не попавшие в layout
            var descs = view._getDescendantsAndSelf( [] );
            for (var i = 0, l = descs.length; i < l; i++) {
                descs[i].hideAndUnbindEvents();
            }
        }
    }
};

/**
 * Обновляем бокс.
 * @param {HTMLElement} node
 * @param {object} options
 * @param {object} events
 * @private
 */
ns.Box.prototype._updateHTML = function(node, options, events) {
    var oldNode;
    // Если
    //  - старой ноды не было
    //  - или этот box не toplevel (т.е. родительский view обновил свою ноду)
    if (!this.node || !options.toplevel) {
        // Ищем новую ноду бокса.
        var newNode = ns.byClass('ns-view-' + this.id, node)[0];
        // И если есть
        if (newNode) {
            // Сохраним ссылку на старую ноду
            oldNode = this.node;
            // Обновим ноду бокса
            this.node = newNode;

            // обновили ноду - эмулируем скрытие и показ
            this._visible = false;
        }
    }

    if (!this.node) {
        throw new Error("[ns.Box] Can't find node for '" + this.id + "'");
    }

    this._hideInactiveViews();

    var views = this.views;
    var boxLayout = this.active;

    //  Строим новый active согласно layout'у.
    //  Т.е. это тот набор блоков, которые должны быть видимы в боксе после окончания всего апдейта
    //  (включая синхронную и все асинхронные подапдейты).
    for (var id in boxLayout) {
        var viewKey = boxLayout[id];

        //  Достаем ранее созданный блок (в _getRequestViews).
        /** @type {ns.View} */
        var view = views[viewKey];

        //  Обновляем его.
        view._updateHTML(node, options, events);

        // Вставка ноды в DOM будет выполнена во время сортировки нод в боксе (ниже).
    }

    // Пройдёмся по всем вложенным видам,
    // чтобы перенести ноды вложенных видов в новую ноду бокса (если есть)
    this._transferViewsToNewNode(oldNode);

    //  Сортируем ноды видов внутри бокса. Попутно добавляются новые ноды видов.
    this._sortViewNodes();

    this._show();
};

/**
 * Сортировка видов внутри бокса.
 * Новые ноды видов также добавляются тут.
 * @private
 */
ns.Box.prototype._sortViewNodes = function() {
    var active = this.active;
    var views = this.views;

    // Итератор по HTMLCollection, который возвращает видимые ноды видов.
    var viewNodesIterator = ns.childrenIterator(this.node);

    for (var viewId in active) {
        var viewKey = active[viewId];
        var view = views[viewKey];
        var cursorViewNode = viewNodesIterator.getNext();

        if (cursorViewNode !== view.node) {
            if (cursorViewNode) {
                this.node.insertBefore(view.node, cursorViewNode);
            } else {
                this.node.appendChild(view.node);
            }
        }
    }
};

/**
 * Переносит неактивные виды из старой ноды в новую после перерисовки бокса.
 * @param {HTMLElement} oldNode
 * @private
 */
ns.Box.prototype._transferViewsToNewNode = function(oldNode) {
    // если старой ноды нет, то значит бокс не перерисовывался
    if (!oldNode) {
        return;
    }

    var views = this.views;
    for (var key in views) {
        var view = views[key];
        // Если вид не входит в новый active
        if (this.active[view.id] !== view.key) {
            var viewNode = view.node;
            // Если нода вида лежит в старой ноде бокса
            if (oldNode.contains(viewNode)) {
                // Перенесём её в новую ноду бокса (сам вид скрыт).
                this.node.appendChild(viewNode);
            }
        }
    }
};

/**
 *
 * @returns {boolean}
 * @private
 */
ns.Box.prototype._show = function() {
    if (this._visible === false) {
        this._visible = true;
        // always returns false to prevent events trigger
    }

    return false;
};

/**
 * Скрывает view
 * @returns {Boolean}
 * @protected
 */
ns.Box.prototype.hideAndUnbindEvents = function() {
    if (this._visible === true) {
        this._visible = false;
    }
};

/**
 * Returns true if box has status NONE
 * @returns {boolean}
 */
ns.Box.prototype.isNone = function() {
    return !this.node;
};

ns.Box.prototype.isValid = function() {
    return !!this.node;
};

/**
 * Очищает себя и все внутренние блоки.
 * Этот блок больше никогда не будет живым, этот метод используется для очистки памяти.
 */
ns.Box.prototype.destroy = function() {
    // уничтожаем детей
    var views = this.views;
    for (var id in views) {
        views[id].destroy();
    }

    if (this.node) {
        $(this.node)
            // события
            .off()
            // данные
            .removeData()
            // удаляем из DOM
            .remove();

        this.node = null;
        this.$node = null;
    }

    this.active = null;
    this.key = null;
    this.params = null;
    this.views = null;

    this._visible = false;
    this.destroyed = true;
};

// копируем нужные методы из ns.View
ns.Box.prototype.__setUniqueId = ns.View.prototype.__setUniqueId;
ns.Box.prototype._getCommonTree = ns.View.prototype._getCommonTree;
ns.Box.prototype.isValidWithDesc = ns.View.prototype.isValidWithDesc;

ns.Box.prototype.isOk = no.true;
ns.Box.prototype.isLoading = no.false;

/**
 * Создает ключ для ns.Box.
 * @param {string} id Название ns.Box.
 * @returns {string}
 * @static
 */
ns.Box.getKey = function(id) {
    return 'box=' + id;
};

/* ../src/ns.box.js end */


    window.no = no;
    window.ns = ns;
})(window, document);
