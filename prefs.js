// vi: et sw=2 fileencoding=utf8
//

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Gettext = imports.gettext.domain('gnome-shell-extensions-AdvancedVolumeMixer');
const _ = Gettext.gettext;

const AVM = imports.misc.extensionUtils.getCurrentExtension();
const Lib = AVM.imports.lib;

let gsettings;
let settings;

function init() {
  gsettings = Lib.getSettings(AVM);
  settings = {
    position: {
      type: "e",
      label: _("Position of volume mixer"),
      list: [
        {nick: "left", name: _("Left"), id: 0},
        {nick: "center", name: _("Center"), id: 1},
        {nick: "right", name: _("Right"), id: 2},
        {nick: "aggregatedMenu", name: _("Aggregated menu"), id: 3},
      ]
    },
    output_type: {
      type: "e",
      label: _("Type of output slider"),
      list: [
        {nick: "default", name: _("Default"), id: 0},
        {nick: "advItem", name: _("AdvItem"), id: 1},
      ]
    }
  };
}

function buildPrefsWidget() {
  let frame = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    border_width: 10
  });
  let vbox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    margin: 20, margin_top: 10
  });
  let hbox;

  for (setting in settings) {
    hbox = buildHbox(settings, setting);
    vbox.add(hbox);
  }

  frame.add(vbox);
  frame.show_all();

  return frame;
}

function buildHbox(settings, setting) {
  let hbox;

  if (settings[setting].type == 's') {
    hbox = createStringSetting(settings, setting);
  } else if (settings[setting].type == "i") {
    hbox = createIntSetting(settings, setting);
  } else if (settings[setting].type == "b") {
    hbox = createBoolSetting(settings, setting);
  } else if (settings[setting].type == "r") {
    hbox = createRangeSetting(settings, setting);
  } else if (settings[setting].type == "e") {
    hbox = createEnumSetting(settings, setting);
  }

  return hbox;
}


function createEnumSetting(settings, setting) {
  let hbox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_top: 5
  });

  let setting_label = new Gtk.Label({
    label: settings[setting].label,
    xalign: 0
  });

  let model = new Gtk.ListStore();
  model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
  let setting_enum = new Gtk.ComboBox({model: model});
  setting_enum.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);
  let renderer = new Gtk.CellRendererText();
  setting_enum.pack_start(renderer, true);
  setting_enum.add_attribute(renderer, 'text', 1);

  for (let i=0; i<settings[setting].list.length; i++) {
    let item = settings[setting].list[i];
    let iter = model.append();
    model.set(iter, [0, 1], [item.id, item.name]);
    if (item.id == gsettings.get_enum(setting.replace('_', '-'))) {
      setting_enum.set_active(item.id);
    }
  }

  setting_enum.connect('changed', function(entry) {
    let [success, iter] = setting_enum.get_active_iter();
    if (!success) {
      return;
    }

    let id = model.get_value(iter, 0)
    gsettings.set_enum(setting.replace('_', '-'), id);
  });

  if (settings[setting].help) {
    setting_label.set_tooltip_text(settings[setting].help)
    setting_enum.set_tooltip_text(settings[setting].help)
  }

  hbox.pack_start(setting_label, true, true, 0);
  hbox.add(setting_enum);

  return hbox;

}

