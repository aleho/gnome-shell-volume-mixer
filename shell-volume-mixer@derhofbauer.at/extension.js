/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
const { Extension } = Lib.main;


function init() {
    return new Extension();
}
