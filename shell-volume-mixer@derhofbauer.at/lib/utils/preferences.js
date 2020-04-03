/**
 * Shell Volume Mixer
 *
 * Convenience class to wrap Gio.Settings.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported open, has, APPS */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Shell = imports.gi.Shell;


var APPS = Object.freeze({
    extension:      'extension',
    control_center: 'control_center',
});

const DEFINITIONS = {
    [APPS.extension]:      {
        desktop: ['org.gnome.Extensions.desktop', 'gnome-shell-extension-prefs.desktop'],
        params:  [Extension.metadata.uuid]
    },
    [APPS.control_center]: {
        desktop: ['gnome-control-center.desktop'],
        params:  ['sound']
    },
};

const INSTANCES = {};


/**
 * @param {string} name
 * @returns {*}
 * @private
 */
function _get(name) {
    if (!(name in INSTANCES)) {
        INSTANCES[name] = null;

        const definition = DEFINITIONS[name];

        for (let desktopFile of definition.desktop) {
            definition.instance = Shell.AppSystem.get_default().lookup_app(desktopFile);

            if (definition.instance) {
                INSTANCES[name] = definition;
            }
        }
    }

    return INSTANCES[name];
}


/**
 * Checks whether a preferences app can be found.
 *
 * @param {string} app
 * @returns {boolean}
 */
function has(app) {
    return !!_get(app);
}


/**
 * Opens a preferences app.
 *
 * @param {string} app
 */
function open(app) {
    const definition = _get(app);

    if (!definition) {
        return;
    }

    const instance = definition.instance;
    const context = global.create_app_launch_context(global.display.get_current_time_roundtrip(), -1);

    instance.get_app_info().launch_uris(
        definition.params,
        context
    );
}
