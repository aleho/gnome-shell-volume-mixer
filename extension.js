// extension.js
// vi: et sw=2
//
// Advanced Volume Mixer
// Control programs' volume from gnome volume mixer applet.
//
// Author: Harry Karvonen <harry.karvonen@gmail.com>
//

const Main = imports.ui.main;
const Lang = imports.lang;

const AVM = imports.misc.extensionUtils.getCurrentExtension();
const Settings = AVM.imports.settings;
const Panel = AVM.imports.panel;
const Mixer = AVM.imports.mixer;

let menu;
let advMixer;
let orgIndicator;

function init() {
  menu = null;
  advMixer = null;
  orgIndicator = null;

  Settings.init();
  Settings.gsettings.connect("changed::", function() {
    disable();
    enable();
  });
}


function enable() {
  advMixer = new Mixer.AdvancedVolumeMixer();

  let pos = Settings.gsettings.get_enum("position");

  if (pos <= 2) {
    menu = new Panel.AdvancedVolumeMixerStatusButton(advMixer);

    if (pos == 0) {
      Main.panel.addToStatusArea("AdvancedVolumeMixer", menu, 999, 'left');
    } else if (pos == 1) {
      Main.panel.addToStatusArea("AdvancedVolumeMixer", menu, 999, 'center');
    } else {
      Main.panel.addToStatusArea("AdvancedVolumeMixer", menu);
    }
  } else {
    advMixer.separatorLastItem(true);

    orgIndicator = Main.panel.statusArea.aggregateMenu._volume;
    orgIndicator.menu.addMenuItem(advMixer);
    orgIndicator._volumeMenu.actor.hide();
    //Main.panel.statusArea.aggregateMenu._volume = advMixer;
  }

}


function disable() {
  if (orgIndicator) {
    //orgIndicator.menu.addMenuItem(orgIndicator._volumeMenu);
    orgIndicator._volumeMenu.actor.show();
  //  Main.panel.statusArea.aggregateMenu._volume = orgIndicator;
    orgIndicator = null;
  }

  if (advMixer) {
    advMixer.destroy();
  }
  advMixer = null;

  if (menu) {
    menu.destroy();
  }
  menu = null;
}

