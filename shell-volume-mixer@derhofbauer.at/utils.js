/**
 * Shell Volume Mixer
 *
 * Utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported getCards, log, debug, repeatString, getExtensionPath, initGettext */

const Config = imports.misc.config;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;

const DOMAIN = 'gnome-shell-extensions-shell-volume-mixer';
const Gettext = imports.gettext;
var _;

const SEP = repeatString('#', 60);


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
 * Calls the Python helper script to get more details about a card and its
 * profiles.
 *
 * @param card Optional parameter to pass to the script.
 * @returns JSON object of the output
 */
function getCards() {
    let pautil = getExtensionPath('pautils/cardinfo.py');

    if (!pautil) {
        return null;
    }

    let ret = GLib.spawn_command_line_sync('python ' + pautil);

    if (!ret || ret[0] !== true || !ret[1]) {
        return null;
    }

    return JSON.parse(ret[1]);
}

/**
 * Helper to debug any variables(s) as string, using separators.
 *
 * @param string, ...
 */
function log() {
    global.log('LOG\n'
            + SEP
            + '\n\n' + Array.prototype.slice.call(arguments).join(' ')
            + '\n\n' + SEP);
}

/**
 * Helper to debug any variable with pretty output.
 *
 * @param object
 * @param maxDepth
 */
function debug(object, maxDepth) {
    maxDepth = maxDepth || 8;
    log(_dumpObject(object, maxDepth));
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
 * Initializes and returns a gettext object ("_").
 */
function initGettext() {
    if (_) {
        return _;
    }

    let domain = Extension.metadata['gettext-domain'] || DOMAIN;
    let localeDir = getExtensionPath('locale');

    if (localeDir) {
        Gettext.bindtextdomain(domain, localeDir);
    } else {
        Gettext.bindtextdomain(domain, Config.LOCALEDIR);
    }

    _ = Gettext.domain(DOMAIN).gettext;
    return _;
}