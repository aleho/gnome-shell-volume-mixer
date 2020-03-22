/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init, enable, disable */

const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;

const { Extension } = Lib.main;

let extension;

function init() {
    extension = new Extension();
}

function enable() {
    extension.enable();
}

function disable() {
    extension.disable();
}
