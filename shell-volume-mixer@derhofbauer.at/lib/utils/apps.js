/**
 * Shell Volume Mixer
 *
 * Convenience class to launch defined apps.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported open, has, APPS */

const Shell = imports.gi.Shell;


var APPS = Object.freeze({
    extension:      'extension',
    control_center: 'control_center',
});

const DEFINITIONS = {
    [APPS.control_center]: {
        desktop: ['gnome-sound-panel.desktop', 'gnome-control-center.desktop'],
        params:  ['sound']
    },
};


/**
 * @param {string} name
 * @returns {*}
 * @private
 */
function _get(name) {
    const definition = DEFINITIONS[name];
    let instance = null;

    for (let desktopFile of definition.desktop) {
        instance = Shell.AppSystem.get_default().lookup_app(desktopFile);

        if (instance) {
            break;
        }
    }

    definition.instance = instance;

    return definition;
}


/**
 * Checks whether an app can be found.
 *
 * @param {string} app
 * @returns {boolean}
 */
function has(app) {
    const definition = _get(app);

    return definition && definition.instance;
}


/**
 * Opens an app.
 *
 * @param {string} app
 */
function open(app) {
    const definition = _get(app);
    if (!definition || !definition.instance) {
        return;
    }

    const appInfo = definition.instance.get_app_info();
    if (!appInfo) {
        return;
    }

    const context = global.create_app_launch_context(global.display.get_current_time_roundtrip(), -1);

    appInfo.launch_uris(
        definition.params,
        context
    );
}
