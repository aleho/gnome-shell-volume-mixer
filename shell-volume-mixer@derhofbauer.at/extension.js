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

let aggregateMenu;
let volumeIndicator;
let volumeIcon;
let volumeMenu;
let volumeActor;
let mixer;

let menu;
let menuSection;
let separator;

function init() {
    settings = new Settings.Settings();
    aggregateMenu = Main.panel.statusArea.aggregateMenu;
    volumeIndicator = aggregateMenu._volume;
    volumeIcon = volumeIndicator._primaryIndicator;
    volumeMenu = volumeIndicator._volumeMenu;
    volumeActor = volumeMenu.actor;
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
        volumeIndicator.menu.addMenuItem(menuSection, 0);
        aggregateMenu.menu.addMenuItem(separator, 1);
        volumeIndicator._volumeMenu = menuSection;

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
    if (volumeIndicator) {
        volumeActor.show();
        volumeIcon.show();
        volumeIndicator._volumeMenu = volumeMenu;
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

    Settings.cleanup();
}
