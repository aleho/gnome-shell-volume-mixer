/**
 * Shell Volume Mixer
 *
 * Gettext proxy implementation.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported _, C_, ngettext */

const Config = imports.misc.config;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const Lib = Extension.imports.lib;

const Utils = Lib.utils.utils;

const DOMAIN = 'gnome-shell-extensions-shell-volume-mixer';
let localGettext;


/**
 * Returns the local gettext instance (extension translations).
 */
function getLocal() {
    if (!localGettext) {
        const domain = Extension.metadata['gettext-domain'] || DOMAIN;
        const localeDir = Utils.getExtensionPath('locale');

        if (localeDir) {
            Gettext.bindtextdomain(domain, localeDir);
        } else {
            Gettext.bindtextdomain(domain, Config.LOCALEDIR);
        }

        localGettext = Gettext.domain(domain);
    }

    return localGettext;
}


/**
 * Proxies a call to a gettext implementation.
 *
 * @param {string} type Gettext function to use
 * @param {Array} args Original gettext call arguments
 */
function proxy(type, args) {
    const local = getLocal()[type];
    const trans = local.apply(local, args);

    // compare with original. if unchanged assume missing translation
    if (trans != args[0]) {
        return trans;
    }

    const global = Gettext[type];
    return global.apply(global, args);
}


/**
 * _ proxy.
 */
// eslint-disable-next-line no-redeclare
function _() {
    return proxy('gettext', arguments);
}

/**
 * C_ proxy.
 */
// eslint-disable-next-line no-redeclare
function C_() {
    return proxy('pgettext', arguments);
}

/**
 * ngettext proxy.
 */
// eslint-disable-next-line no-redeclare
function ngettext() {
    return proxy('ngettext', arguments);
}
