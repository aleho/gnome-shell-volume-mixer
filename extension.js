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

function init() {
  menu = null;
  advMixer = null;
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
  }

}


function disable() {
  if (advMixer) {
    advMixer.destroy();
  }
  advMixer = null;

  if (menu) {
    menu.destroy();
  }
  menu = null;
}

