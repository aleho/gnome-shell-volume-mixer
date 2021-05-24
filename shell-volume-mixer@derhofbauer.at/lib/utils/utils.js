/**
 * Shell Volume Mixer
 *
 * Utilities.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported getCards, getExtensionPath, mixin */

const Extension = imports.misc.extensionUtils.getCurrentExtension();


/**
 * Returns this extension's path, optionally querying a subdirectory or file.
 *
 * @param {string} [subpath] Subdirectory or -path to get.
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
 * Allows a target object to receive all properties from a source.
 */
function mixin(target, source, keepExisting = false) {
    const sourceProps = Object.getOwnPropertyDescriptors(source.prototype);

    for (let name of Object.keys(sourceProps)) {
        if (keepExisting === true && Object.prototype.hasOwnProperty.call(target, name)) {
            continue;
        }

        Object.defineProperty(target.prototype, name, sourceProps[name]);
    }
}
