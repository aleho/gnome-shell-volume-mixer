/**
 * Shell Volume Mixer
 *
 * Utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported getCards, l, d, info, error, repeatString, getExtensionPath, versionGreaterOrEqual, mixin */

const ByteArray = imports.byteArray;
const Config = imports.misc.config;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const { Gio } = imports.gi;

const LOG_PREAMBLE = 'Shell Volume Mixer';

const PYTHON_HELPER_PATH = 'pautils/cardinfo.py';


/**
 * Returns this extension's path, optionally querying a subdirectory or file.
 *
 * @param subpath Optional. Subdirectory or -path to get.
 */
function getExtensionPath(subpath) {
    let dir = Extension.dir;

    if (subpath) {
        dir = dir.get_child(subpath);
    }

    if (!dir.query_exists(null)) {
        return null;
    }

    return dir.get_path();
}

/**
 * Parses a version string and returns an array.
 *
 * @param string
 * @returns array
 */
function parseVersionString(string) {
    let version = string.split('.', 3);

    for (let i = 0; i < 3; i++) {
        if (version[i]) {
            version[i] = parseInt(version[i]);
        } else {
            version[i] = 0;
        }
    }

    return version;
}

/**
 * Returns true if the current shell version is greater than the version string passed.
 *
 * @param version
 */
function versionGreaterOrEqual(string) {
    let current = parseVersionString(Config.PACKAGE_VERSION);
    let version = parseVersionString(string);

    for (let i = 0; i < 3; i++) {
        if (current[i] < version[i]) {
            return false;
        }
    }

    return true;
}


/**
 * Executes an async command.
 *
 * @param {Array} command
 * @return {Promise<[int, string, string]>}
 */
async function execAsync(command) {
    const process = new Gio.Subprocess({
        argv:  command,
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    });

    process.init(null);

    return new Promise((resolve, reject) => {
        process.communicate_utf8_async(null, null, (process, result) => {
            try {
                const [success, stdout, stderr] = process.communicate_utf8_finish(result);
                const ret = process.get_exit_status();

                if (!success) {
                    reject(Error('Error spawning subprocess'));
                } else {
                    resolve([ret, stdout, stderr]);
                }

            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Calls the Python helper script to get more details about a card and its
 * profiles.
 *
 * @return {Promise<?Object.<string, paCard>>} JSON object of the output
 */
async function getCards() {
    const paUtilPath = getExtensionPath(PYTHON_HELPER_PATH);

    if (!paUtilPath) {
        error('utils', 'getCards', 'Could not find PulseAudio utility in extension path ' + PYTHON_HELPER_PATH);
        return null;
    }

    let output;
    let pythonError;

    try {
        output = await execAsync(['/usr/bin/env', 'python3', paUtilPath]);
    } catch (pythonError) {
        try {
            output = await execAsync(['/usr/bin/env', 'python', paUtilPath]);
        } catch (pythonError) {
            // eslint-disable-no-empty
        }
    } finally {
        if (pythonError) {
            error('utils', 'getCards', pythonError.message);
        }
    }

    if (!output) {
        return null;
    }

    let ret = null;
    try {
        if (output instanceof Uint8Array) {
            output = ByteArray.toString(output);
        }
        ret = JSON.parse(output);
    } catch (e) {
        error('utils', 'getCards', e.message);
        return null;
    }

    if (!ret || typeof ret !== 'object') {
        error('utils', 'getCards', 'Invalid response');
        return null;
    }

    if ('success' in ret && ret.success === false) {
        error('utils', 'getCards', 'Error: ' + ret.error);
        return null;
    }

    return ret;
}


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
 * @param object
 * @param maxDepth
 */
function d(object, maxDepth) {
    maxDepth = maxDepth || 1;
    l(_dumpObject(object, maxDepth));
}

/**
 * Logs an error message.
 *
 * @param module Module the error occurred in.
 * @param context Optional.
 * @param message Error message.
 */
function error(module, context, message) {
    if (module && !context && !message) {
        message = module;
        module = undefined;
        context = undefined;
    }
    if (context && !message) {
        message = context;
        context = undefined;
    }
    let output = `${LOG_PREAMBLE} | ERROR | `;
    if (module) {
        output += module + '.js | ';
    }
    if (context) {
        output += context + '() | ';
    }
    l(output + message);
}

/**
 * Dumps any variable into a string that can be output through log().
 *
 * @param object
 * @param maxDepth
 * @param currDepth
 * @returns
 */
function _dumpObject(object, maxDepth, currDepth) {
    maxDepth = maxDepth || 8;
    currDepth = currDepth || 0;

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
        indent = repeatString('\u00A0', currDepth * 4);

    } else {
        let objectString = object.toString();
        dump += objectString
            + '\n' + repeatString('-', objectString.length)
            + '\n';

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

        dump += indent + key + ' => (' + typeInfo + ')';

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
                    dump += ' ' + itemString;
                }
                dump += ' {';
            }

            let objDump = _dumpObject(item, maxDepth, currDepth + 1);

            if (objDump.trim() !== '') {
                dump += '\n' + objDump + '\n' + indent;
            }

            dump += (isArray) ? ']' : '}';

        } else {
            dump += ' ' + item;
        }
    }

    return dump;
}


/**
 * Helper to repeat a given string.
 *
 * @param string
 * @param times
 * @returns string
 */
function repeatString(string, times) {
    return new Array(times + 1).join(string);
}


/**
 * Allows a target object to receive all properties from a source.
 */
function mixin(target, source) {
    const sourceProps = Object.getOwnPropertyDescriptors(source.prototype);

    for (let name in sourceProps) {
        Object.defineProperty(target.prototype, name, sourceProps[name]);
    }
}
