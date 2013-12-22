// vi: et sw=2 fileencoding=utf8
//

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

function getSettings(ext) {
  let schemaName = "org.gnome.shell.extensions.AdvancedVolumeMixer";
  let schemaDir = ext.dir.get_child("schemas").get_path();

  if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
      schemaDir,
      Gio.SettingsSchemaSource.get_default(),
      false
    );
    let schema = schemaSource.lookup(schemaName, false);

    return new Gio.Settings({
      settings_schema: schema
    });
  } else {
    if (Gio.Settings.list_schemas().indexOf(schemaName) == -1) {
      throw "Schema \"%s\" not found.".format(schemaName);
    }

    return new Gio.Settings({ schema: schemaName });
  }
}
