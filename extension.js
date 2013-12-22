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
}


function enable() {
  advMixer = new Mixer.AdvancedVolumeMixer();
  menu = new Panel.AdvancedVolumeMixerStatusButton(advMixer);
  Main.panel.addToStatusArea("AdvancedVolumeMixer", menu)

  menu.setMixer(advMixer);
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

