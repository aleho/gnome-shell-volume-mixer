/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Mixer = Extension.imports.mixer;
const Panel = Extension.imports.panel;
const Settings = Extension.imports.settings;

let statusMenu;
let volumeMenu;
let volumeMixer;
let volumeIcon;

let menu;
let menuSection;
let separator;

function init() {
    statusMenu = Main.panel.statusArea.aggregateMenu;
    volumeMenu = Main.panel.statusArea.aggregateMenu._volume;
    volumeMixer = volumeMenu._volumeMenu.actor;
    volumeIcon = volumeMenu._primaryIndicator;

    Settings.gsettings().connect('changed::', function() {
        let isEnabled = Extension.state === 1;
        disable();
        if (isEnabled) {
            enable();
        }
    });
}

function enable() {
    let pos = Settings.gsettings().get_enum('position');


    if (pos === 0) {
        separator = new PopupMenu.PopupSeparatorMenuItem();
        menuSection = new Mixer.Menu(false);
        volumeMixer.hide();
        volumeMenu.menu.addMenuItem(menuSection, 0);
        statusMenu.menu.addMenuItem(separator, 1);

    } else {
        let removeOriginal = Settings.gsettings().get_boolean('remove-original');
        if (removeOriginal) {
            volumeMixer.hide();
            volumeIcon.hide();
        }
        menuSection = new Mixer.Menu(true);
        menu = new Panel.Button(menuSection);

        if (pos === 1) {
            Main.panel.addToStatusArea('ShellVolumeMixer', menu, 999, 'left');
        } else if (pos === 2) {
            Main.panel.addToStatusArea('ShellVolumeMixer', menu, 999, 'center');
        } else {
            Main.panel.addToStatusArea('ShellVolumeMixer', menu);
        }
    }
}

function disable() {
    if (volumeMenu) {
        volumeMixer.show();
        volumeIcon.show();
    }

    if (menuSection) {
        menuSection.destroy();
        menuSection = null;
    }

    if (separator) {
        separator.destroy();
        separator = null;
    }

    if (menu) {
        menu.destroy();
        menu = null;
    }
}