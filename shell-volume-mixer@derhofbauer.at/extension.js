/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init */

const ExtensionUtils = imports.misc.extensionUtils;
const Lib = ExtensionUtils.getCurrentExtension().imports.lib;

const { Extension } = Lib.main;


function init() {
    ExtensionUtils.initTranslations();

    return new Extension();
}
