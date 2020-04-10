/**
 * Shell Volume Mixer
 *
 * Logging.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported l, d, info, error */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Extension.imports.lib;
const StringUtils = Lib.utils.string;

const LOG_PREAMBLE = Extension.metadata.uuid || 'Shell Volume Mixer';


/**
 * Helper to debug any variables(s) as string, using separators.
 *
 * @param {...string}
 */
function l() {
    log(Array.prototype.slice.call(arguments).join(' '));
}

function info() {
    log(`${LOG_PREAMBLE} | ${Array.prototype.slice.call(arguments).join(' ')}`);
}

/**
 * Helper to debug any variable with pretty output.
 *
 * @param {*} object
 * @param {number} maxDepth
 */
function d(object, maxDepth = 1) {
    l(_dumpObject(object, maxDepth));
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
        indent = StringUtils.repeat('\u00A0', currDepth * 4);

    } else {
        let objectString = object.toString();
        dump += `${objectString}\n${StringUtils.repeat('-', objectString.length)}\n\n`;

        if (typeof object == 'string') {
            stringMode = true;
        }
    }

    let isFirst = true;

    for (let key in object) {
        let item = object[key];
        let isArray = Array.isArray(item);
        let type = typeof item;
        let typeInfo = type;

        if (stringMode) {
            if (isNaN(key)) {
                // don't debug string methods
                break;
            }
            typeInfo = object.charCodeAt(key);
        }

        if (!isFirst) {
            dump += ',\n';
        }
        isFirst = false;

        dump += `${indent + key} => (${typeInfo})`;

        if (item === null) {
            dump += ' null';

        } else if (type == 'object' || type == 'function') {
            if (isArray) {
                dump += ' [';
            } else if (type == 'function') {
                dump += ' {';
            } else {
                // we're assuming toString() yields sane values
                let itemString = item.toString();
                if (itemString != '[object Object]') {
                    dump += ` ${itemString}`;
                }
                dump += ' {';
            }

            let objDump = _dumpObject(item, maxDepth, currDepth + 1);

            if (objDump.trim() !== '') {
                dump += `\n${objDump}\n${indent}`;
            }

            dump += (isArray) ? ']' : '}';

        } else {
            dump += ` ${item}`;
        }
    }

    return dump;
}
