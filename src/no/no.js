// ----------------------------------------------------------------------------------------------------------------- //
// no
// ----------------------------------------------------------------------------------------------------------------- //

var no = {};

// ----------------------------------------------------------------------------------------------------------------- //

no.inherits = function(child, parent) {
    var F = function() {};
    F.prototype = parent.prototype;
    child.prototype = new F();
    child.prototype.constructor = child;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
no.extend = function(dest) {
    var srcs = [].slice.call(arguments, 1);

    for (var i = 0, l = srcs.length; i < l; i++) {
        var src = srcs[i];
        for (var key in src) {
            dest[key] = src[key];
        }
    }

    return dest;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    Do not clone functions, only data.
    @param {!Object} dest
    @param {...!Object} srcs
    @return {!Object}
*/
no.extendRecursive = function(dest) {
    var srcs = [].slice.call(arguments, 1);

    for (var i = 0, l = srcs.length; i < l; i++) {
        var src = srcs[i];
        for (var key in src) {
            var value = src[key];
            if (no.isArray(value)) {
                var ar = [];
                for (var j = 0; j < value.length; j++) {
                    var item = value[j];
                    if (typeof item === "object") {
                        ar[j] = no.extendRecursive({}, item);
                    } else {
                        ar[j] = item;
                    }
                }
                dest[key] = ar;
            }
            else if (typeof value === "object") {
                dest[key] = {};
                no.extendRecursive(dest[key], value);
            } else {
                dest[key] = value;
            }
        }
    }

    return dest;
};

// ----------------------------------------------------------------------------------------------------------------- //

no.isArray = Array.isArray; // TODO old browsers version

/**
    Пустая функция. No operation.
*/
no.pe = function() {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} className
    @param {Element} context
    @return {Array.<Element>}
*/
no.byClass = function(className, context) {
    context = context || document;
    return context.getElementsByClassName(className); // FIXME: Поддержка старых браузеров.
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {Element} oldNode
    @param {Element} newNode
*/
no.replaceNode = function(oldNode, newNode) {
    oldNode.parentNode.replaceChild(newNode, oldNode);
};

// ----------------------------------------------------------------------------------------------------------------- //

no.todo = function() {
    throw new Error('Unimplemented');
};
