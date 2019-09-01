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
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const { Indicator } = Lib.menu.indicator;
const { Mixer } = Lib.volume.mixer;
const { PanelButton } = Lib.widget.panelButton;
const Settings = Lib.settings;

let settings;

let aggregateMenu;
let volumeIndicator;
let volumeIcon;
let volumeMenu;
let mixer;

let menu;
let gvmIndicator;

function init() {
    settings = new Settings.Settings();
    aggregateMenu = Main.panel.statusArea.aggregateMenu;
    volumeIndicator = aggregateMenu._volume;
    volumeIcon = volumeIndicator._primaryIndicator;
    volumeMenu = volumeIndicator._volumeMenu;
}

function enable() {
    settings.connectChanged(() => {
        disable();
        enable();
    });

    mixer = new Mixer();

    let position = settings.get_enum('position');

    if (position === Settings.POS_MENU) {
        replaceOriginal();
    } else {
        addPanelButton(position);
    }
}

function replaceOriginal() {
    gvmIndicator = new Indicator(mixer, {
        separator: false
    });

    volumeMenu.actor.hide();
    volumeIcon.hide();

    // get current indicator position
    let indicators = aggregateMenu._indicators.get_children();
    let indicatorPos = 4;
    for (let i = 0; i < indicators.length; i++) {
        if (volumeIndicator.indicators == indicators[i]) {
            indicatorPos = i;
            break;
        }
    }

    // add our own indicator and menu
    aggregateMenu._volume = gvmIndicator;
    aggregateMenu._indicators.insert_child_at_index(gvmIndicator.indicators, indicatorPos);
    aggregateMenu.menu.addMenuItem(gvmIndicator.menu, 0);

    aggregateMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 1);

    // on disable/enable we won't get a stream-changed event, so trigger it here to be safe
    gvmIndicator.updateIcon();
}

function addPanelButton(position) {
    let removeOriginal = settings.get_boolean('remove-original');
    if (removeOriginal) {
        volumeMenu.actor.hide();
        volumeIcon.hide();
    }

    menu = new PanelButton(mixer);

    if (position === Settings.POS_LEFT) {
        Main.panel.addToStatusArea('ShellVolumeMenu', menu, 999, 'left');
    } else if (position === Settings.POS_CENTER) {
        Main.panel.addToStatusArea('ShellVolumeMenu', menu, 999, 'center');
    } else {
        Main.panel.addToStatusArea('ShellVolumeMenu', menu);
    }
}

function disable() {
    volumeMenu.actor.show();
    volumeIcon.show();
    aggregateMenu._volume = volumeIndicator;

    if (mixer) {
        mixer.disconnectAll();
        mixer = null;
    }

    if (gvmIndicator) {
        aggregateMenu._indicators.remove_actor(gvmIndicator.indicators);
        gvmIndicator.destroy();
        gvmIndicator = null;
    }

    if (menu) {
        menu.destroy();
        menu = null;
    }

    Settings.cleanup();
}
