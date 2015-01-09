/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init, enable, disable */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Menu = Extension.imports.menu;
const Mixer = Extension.imports.mixer;
const Panel = Extension.imports.panel;
const Settings = Extension.imports.settings;

let settings;

let statusMenu;
let volumeMenu;
let volumeActor;
let volumeIcon;
let mixer;

let menu;
let menuSection;
let separator;

function init() {
    settings = new Settings.Settings();
    statusMenu = Main.panel.statusArea.aggregateMenu;
    volumeMenu = Main.panel.statusArea.aggregateMenu._volume;
    volumeActor = volumeMenu._volumeMenu.actor;
    volumeIcon = volumeMenu._primaryIndicator;
}

function enable() {
    settings.connectChanged(function() {
        disable();
        enable();
    });

    mixer = new Mixer.Mixer();

    let pos = settings.get_enum('position');

    if (pos === Settings.POS_MENU) {
        separator = new PopupMenu.PopupSeparatorMenuItem();
        menuSection = new Menu.Menu(mixer, {
            separator: false
        });
        volumeActor.hide();
        volumeMenu.menu.addMenuItem(menuSection, 0);
        statusMenu.menu.addMenuItem(separator, 1);

    } else {
        let removeOriginal = settings.get_boolean('remove-original');
        if (removeOriginal) {
            volumeActor.hide();
            volumeIcon.hide();
        }
        menuSection = new Menu.Menu(mixer, {
            separator: true
        });
        menu = new Panel.Button(menuSection);

        if (pos === Settings.POS_LEFT) {
            Main.panel.addToStatusArea('ShellvolumeActor', menu, 999, 'left');
        } else if (pos === Settings.POS_CENTER) {
            Main.panel.addToStatusArea('ShellvolumeActor', menu, 999, 'center');
        } else {
            Main.panel.addToStatusArea('ShellvolumeActor', menu);
        }
    }
}

function disable() {
    if (volumeMenu) {
        volumeActor.show();
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

    if (mixer) {
        mixer.disconnectAll();
        mixer = null;
    }

    settings.disconnectAll();
}