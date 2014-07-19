/**
 * Shell Volume Mixer
 *
 * Advanced mixer extension.
 *
 * @author Harry Karvonen <harry.karvonen@gmail.com>
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init,gsettings */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let localGsettings;

function gsettings() {
    if (!localGsettings) {
        localGsettings = getSettings();
    }
    return localGsettings;
}

function getSettings() {
    let schemaName = 'org.gnome.shell.extensions.shell-volume-mixer';
    let schemaDir = Extension.dir.get_child('schemas').get_path();

    if (GLib.file_test(schemaDir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
        let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir,
                Gio.SettingsSchemaSource.get_default(),
                false);

        return new Gio.Settings({
            settings_schema: schemaSource.lookup(schemaName, false)
        });

    } else if (Gio.Settings.list_schemas().indexOf(schemaName) == -1) {
        throw 'Schema "%s" not found'.format(schemaName);

    } else {
        return new Gio.Settings({ schema: schemaName });
    }
}