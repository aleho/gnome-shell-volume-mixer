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
const Volume = imports.ui.status.volume;

const Mixer = Extension.imports.mixer;
const Panel = Extension.imports.panel;
const Settings = Extension.imports.settings;

let settings;

let statusMenu;
let volumeMenu;
let volumeMixer;
let volumeIcon;
let mixerControl;

let menu;
let menuSection;
let separator;

function init() {
    settings = new Settings.Settings();
    statusMenu = Main.panel.statusArea.aggregateMenu;
    volumeMenu = Main.panel.statusArea.aggregateMenu._volume;
    volumeMixer = volumeMenu._volumeMenu.actor;
    volumeIcon = volumeMenu._primaryIndicator;
    mixerControl = Volume.getMixerControl();
}

function enable() {
    settings.connectChanged(function() {
        disable();
        enable();
    });

    let pos = settings.get_enum('position');
    let detailed = settings.get_boolean('show-detailed-sliders');
    let boostVolume = settings.get_boolean('use-volume-boost');

    // monkey patch maximum volume calculations
    if (boostVolume && !mixerControl._org_get_vol_max_norm) {
        mixerControl._org_get_vol_max_norm = mixerControl.get_vol_max_norm;
        mixerControl.get_vol_max_norm = mixerControl.get_vol_max_amplified;
    }

    if (pos === Settings.POS_MENU) {
        separator = new PopupMenu.PopupSeparatorMenuItem();
        menuSection = new Mixer.Menu(mixerControl, {
            separator: false,
            detailed: detailed
        });
        volumeMixer.hide();
        volumeMenu.menu.addMenuItem(menuSection, 0);
        statusMenu.menu.addMenuItem(separator, 1);

    } else {
        let removeOriginal = settings.get_boolean('remove-original');
        if (removeOriginal) {
            volumeMixer.hide();
            volumeIcon.hide();
        }
        menuSection = new Mixer.Menu(mixerControl, {
            separator: true,
            detailed: detailed
        });
        menu = new Panel.Button(menuSection);

        if (pos === Settings.POS_LEFT) {
            Main.panel.addToStatusArea('ShellVolumeMixer', menu, 999, 'left');
        } else if (pos === Settings.POS_CENTER) {
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

    settings.disconnectAll();

    // undo monkey patch
    if (typeof mixerControl._org_get_vol_max_norm == 'function') {
        mixerControl.get_vol_max_norm = mixerControl._org_get_vol_max_norm;
        delete mixerControl._org_get_vol_max_norm;
    }
}