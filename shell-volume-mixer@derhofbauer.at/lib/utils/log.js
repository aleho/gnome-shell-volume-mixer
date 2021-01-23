/**
 * Shell Volume Mixer
 *
 * Logging.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported l, d, info, error, dump, verbose */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Extension.imports.lib;

const LOG_PREAMBLE = Extension.metadata.uuid || 'Shell Volume Mixer';


var verbose = false;


/**
 * Helper to debug any variables(s) as string, using separators.
 *
 * @param {...string}
 */
function l() {
    log(Array.prototype.slice.call(arguments).join(' '));
}

/**
 * Logs verbose messages, if enabled.
 *
 * @param {...string}
 */
function info() {
    if (verbose) {
        log(`${LOG_PREAMBLE} | ${Array.prototype.slice.call(arguments).join(' ')}`);
    }
}

/**
 * Helper to debug any variable with pretty output.
 *
 * @param {*} object
 * @param {number} maxDepth
 */
function d(object, maxDepth = 1) {
    try {
        l(_dumpObject(object, maxDepth));
    } catch (e) {
        l(object);
    }
}

/**
 * Logs an error message.
 *
 * @param {string} module Module the error occurred in.
 * @param {string} context Optional.
 * @param {string|Error} error Error or error message (to construct Error from).
 */
function error(module, context, error) {
    if (module && !context && !error) {
        error = module;
        module = undefined;
        context = undefined;
    }
    if (context && !error) {
        error = context;
        context = undefined;
    }

    let output = LOG_PREAMBLE;
    if (module) {
        output += ` | ${module}.js`;
    }
    if (context) {
        output += ` | ${context}()`;
    }

    if (!(error instanceof Error)) {
        error = Error(error);
    }

    logError(error, output);
}

/**
 * Helper to dump any variable to a string.
 *
 * @param {*} object
 * @param {number} maxDepth
 */
function dump(object, maxDepth) {
    try {
        return _dumpObject(object, maxDepth);
    } catch (e) {
        return `Error dumping object: ${e}`;
    }
}


/**
 * Dumps any variable into a string that can be output through log().
 *
 * @param {*} object
 * @param {number} maxDepth
 * @param {number} currDepth
 * @returns {string}
 */
function _dumpObject(object, maxDepth = 8, currDepth = 0) {
    if (currDepth > maxDepth) {
        return '';
    }

    if (object === null) {
        return 'null';
    }

    if (object === undefined) {
        return 'undefined';
    }

    let dump = '';
    let indent = '';
    let stringMode = false;


    if (currDepth > 0) {
        indent = '\u00A0'.repeat(currDepth * 4);

    } else {
        let objectString = object.toString();
        dump += `${objectString}\n${'-'.repeat(objectString.length)}\n\n`;

        if (typeof object == 'string') {
            stringMode = true;
        }
    }

    let isFirst = true;

    for (let key in object) {
        const item = object[key];
        const type = typeof item;
        let typeInfo = type;

        if (stringMode) {
            let pos = parseInt(key);
            if (isNaN(pos)) {
                // don't debug string methods
                break;
            }
            typeInfo = object.charCodeAt(pos);
        }

        if (!isFirst) {
            dump += ',\n';
        }
        isFirst = false;

        dump += `${indent + key} => (${typeInfo})`;

        if (item === null) {
            dump += ' null';

        } else if (type ==='object' || type === 'function') {
            const isArray = Array.isArray(item);

            if (isArray) {
                dump += ' [';
            } else if (type === 'function') {
                dump += ' (';
            } else {
                // we're assuming toString() yields sane values
                let itemString = item.toString();
                if (itemString !== '[object Object]') {
                    dump += ` ${itemString}`;
                }
                dump += ' {';
            }

            let objDump = '';
            try {
                objDump = _dumpObject(item, maxDepth, currDepth + 1);
            } catch (e) {
                // object cannot be dumped, probably a non-null pointer
            }

            if (objDump.trim() !== '') {
                dump += `\n${objDump}\n${indent}`;
            }

            if (isArray) {
                dump += ']';
            } else if (type === 'function') {
                dump += ')';
            } else {
                dump += '}';
            }

        } else {
            dump += ` ${item}`;
        }
    }

    return dump;
}
