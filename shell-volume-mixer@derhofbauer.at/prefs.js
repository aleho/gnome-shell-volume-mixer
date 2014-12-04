/**
 * Shell Volume Mixer
 *
 * Preferences widget.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init, buildPrefsWidget */

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Settings = Extension.imports.settings;
const Utils = Extension.imports.utils;

let preferences;

const Preferences = new Lang.Class({
    Name: 'ShellVolumeMixerPreferences',

    _objects: {
        cmbPosition: null,
        swRemoveOriginal: null,
        swShowDetailedSliders: null,
        swUseVolumeBoost: null,
        txtProfileSwitch: null,
        treeDevices: null,
        treePinned: null,
        btnAddDevice: null,
        btnRemoveDevice: null,
        rndQuickswitch: null,
        rndDisplay: null
    },

    _init: function() {
        Utils.initGettext();
        this._settings = new Settings.Settings();
    },

    buildWidget: function() {
        this.builder = new Gtk.Builder();
        this.builder.add_from_file(Utils.getExtensionPath('prefs.ui'));

        this._devices = this.builder.get_object('storeDevices');
        this._pinned = this.builder.get_object('storePinned');

        this._connectAndInitUi();
        this._initCards();
        this._populatePinned();

        return this.builder.get_object('tabs');
    },

    _connectAndInitUi: function() {
        for (let k in this._objects) {
            this._objects[k] = this.builder.get_object(k);
        }

        this._deviceSelection = this._objects.treeDevices.get_selection();
        this._deviceSelection.set_select_function(Lang.bind(this, this.onDeviceSelection));
        this._deviceSelection.connect('changed', Lang.bind(this, this.onDeviceSelectionChanged));

        this._pinnedSelection = this._objects.treePinned.get_selection();
        this._pinnedSelection.connect('changed', Lang.bind(this, this.onPinnedSelectionChanged));

        this._objects.rndQuickswitch.connect('toggled', Lang.bind(this, this.onQuickswitchToggled));
        this._objects.rndDisplay.connect('toggled', Lang.bind(this, this.onDisplayToggled));

        this._objects.cmbPosition.set_active(this._settings.get_enum('position'));
        this._objects.swRemoveOriginal.set_active(this._settings.get_boolean('remove-original'));
        this._objects.swShowDetailedSliders.set_active(this._settings.get_boolean('show-detailed-sliders'));
        this._objects.swUseVolumeBoost.set_active(this._settings.get_boolean('use-volume-boost'));
        this._objects.txtProfileSwitch.set_text(this._settings.get_array('profile-switcher-hotkey')[0] || '');

        this._bindSignal('cmbPosition', 'changed', this.onPositionChanged, 'position');
        this._bindSignal('swRemoveOriginal', 'notify::active', this.onSwitchActivate, 'remove-original');
        this._bindSignal('swShowDetailedSliders', 'notify::active', this.onSwitchActivate, 'show-detailed-sliders');
        this._bindSignal('swUseVolumeBoost', 'notify::active', this.onSwitchActivate, 'use-volume-boost');
        this._bindSignal('txtProfileSwitch', 'changed', this.onProfileSwitchChanged, 'profile-switcher-hotkey');
        this._bindSignal('btnAddDevice', 'clicked', this.onAddDevice);
        this._bindSignal('btnRemoveDevice', 'clicked', this.onRemoveDevice);

        this.onPositionChanged(this._objects.cmbPosition);
    },


    /**
     * Initializes the content of the cards / profiles selection tree.
     */
    _initCards: function() {
        this._cards = {};
        let cards = Utils.getCards();

        let details = this._objects.swShowDetailedSliders.active;

        for (let k in cards) {
            let card = cards[k];
            let row = this._devices.append(null);
            this._devices.set(row, [0, 1, 2], [card.description, '', '']);

            let profiles = {};

            for (let profile of card.profiles) {
                if (profile.name == 'off' || profile.available === false) {
                    continue;
                }

                let invalid = false;

                let test = profile.name.split('+');
                for (let parts of test) {
                    let [part] = parts.split(':', 1);
                    // profiles containing 'input' won't be accepted by Gvc
                    if (part == 'input') {
                        invalid = true;
                        break;
                    }
                }

                if (invalid) {
                    continue;
                }

                let profiletext = profile.description;
                if (details) {
                    profiletext += '\n' + profile.name;
                }

                this._devices.set(this._devices.append(row), [0, 1, 2],
                        [profiletext, card.name, profile.name]);

                profiles[profile.name] = {
                    description: profile.description,
                    pinned: false
                };
            }

            this._cards[card.name] = {
                description: card.description,
                profiles: profiles
            };
        }

        this._objects.treeDevices.expand_all();
    },

    /**
     * Updates the content of the selection list with all values from the
     * settings key.
     */
    _populatePinned: function() {
        let pinned = this._settings.get_array('pinned-profiles');
        this._pinned.clear();

        for (let item of pinned) {
            if (!item) {
                continue;
            }
            let entry = null;
            try {
                entry = JSON.parse(item);
            } catch (e) {
                Utils.error('prefs', '_populatePinned', e.message);
            }
            if (!entry || !entry.card || !entry.profile) {
                continue;
            }

            let card = this._cards[entry.card];
            if (!card) {
                continue;
            }

            let profile = card.profiles[entry.profile];
            if (!profile) {
                continue;
            }

            profile.pinned = true;

            this._pinned.set(this._pinned.append(), [0, 1, 2, 3, 4, 5], [
                card.description, profile.description,
                entry.switcher, entry.show,
                entry.card, entry.profile
            ]);
        }
    },

    /**
     * Returns the entries in the selection list as array of strings.
     */
    _storePinned: function() {
        let values = [];
        let [success, iter] = this._pinned.get_iter_first();

        while (iter && success) {
            values.push(JSON.stringify({
                card: this._pinned.get_value(iter, 4),
                profile: this._pinned.get_value(iter, 5),
                switcher: this._pinned.get_value(iter, 2),
                show: this._pinned.get_value(iter, 3)
            }));
            success = this._pinned.iter_next(iter);
        }

        this._settings.set_array('pinned-profiles', values);
    },


    /**
     * Binds a signal to an object, passing the object and additionally the
     * settings key to the callback.
     *
     * @param id Object, identified by id.
     * @param signal
     * @param callback
     * @param setting Key in settings, passed to the callback.
     */
    _bindSignal: function(id, signal, callback, setting) {
        this._objects[id].connect(signal, Lang.bind(this, function(el) {
            callback.apply(this, [el, setting]);
        }));
    },


    /**
     * Callback for change event of combobox.
     */
    onPositionChanged: function(cmbPosition, setting) {
        let value = cmbPosition.get_active();

        if (setting) {
            this._settings.set_enum(setting, value);
        }

        let checkbox = this._objects.swRemoveOriginal;
        if (!checkbox) {
            return;
        }

        if (value === Settings.POS_MENU) {
            checkbox.set_sensitive(false);
        } else {
            checkbox.set_sensitive(true);
        }
    },

    /**
     * Callback for all switches.
     */
    onSwitchActivate: function(widget, setting) {
        this._settings.set_boolean(setting, widget.active);
    },

    /**
     * Callback for change event of profile switcher.
     */
    onProfileSwitchChanged: function(widget, setting) {
        let entry = widget.get_text().trim();

        if (!entry) {
            this._settings.set_array(setting, []);
            return;
        }

        let [key, mods] = Gtk.accelerator_parse(entry);
        if (key === 0) {
            return;
        }

        let hotkey = Gtk.accelerator_name(key, mods);
        if (!hotkey) {
            return;
        }

        widget.set_text(hotkey);
        // Main.wm.addKeybinding expects an array
        this._settings.set_array(setting, [hotkey]);
    },


    /**
     * Selection event for devices, before selection is set.
     */
    onDeviceSelection: function(selection, model, path) {
        if (!path || path.get_depth() < 2) {
            return false;
        }

        return true;
    },

    /**
     * Determines whether selection allows to enable the add button.
     */
    onDeviceSelectionChanged: function(selection) {
        this._objects.btnAddDevice.set_sensitive(false);

        if (selection.count_selected_rows() <= 0) {
            return;
        }

        let [success, store, iter] = selection.get_selected();

        if (!success) {
            return;
        }

        let cardid = store.get_value(iter, 1);
        let profileid = store.get_value(iter, 2);

        if (this._cards[cardid].profiles[profileid].pinned) {
            // don't allow pinning of already pinned profiles
            return;
        }

        this._objects.btnAddDevice.set_sensitive(true);
    },

    /**
     * Determines whether selection allows to enable the remove button.
     */
    onPinnedSelectionChanged: function(selection) {
        if (selection.count_selected_rows() > 0) {
            this._objects.btnRemoveDevice.set_sensitive(true);
        } else {
            this._objects.btnRemoveDevice.set_sensitive(false);
        }
    },


    /**
     * Callback for add button.
     */
    onAddDevice: function(widget) {
        widget.set_sensitive(false);

        let [isSelected, store, iter] = this._deviceSelection.get_selected();

        if (!isSelected) {
            return;
        }

        let cardid = store.get_value(iter, 1);
        let profileid = store.get_value(iter, 2);

        let card = this._cards[cardid];
        let profile = this._cards[cardid].profiles[profileid];

        if (profile.pinned) {
            // safety check, we should never reach this anyway
            return;
        }

        profile.pinned = true;

        this._pinned.set(this._pinned.append(), [0, 1, 2, 3, 4, 5],
                [card.description, profile.description, true, true, cardid, profileid]);
        this._storePinned();
    },

    /**
     * Callback for remove button.
     */
    onRemoveDevice: function() {
        let [isSelected, store, iter] = this._pinnedSelection.get_selected();

        if (!isSelected) {
            return;
        }

        let cardid = store.get_value(iter, 4);
        let profileid = store.get_value(iter, 5);

        this._cards[cardid].profiles[profileid].pinned = false;

        store.remove(iter);
        this._storePinned();

        // now check for the currently selected entry in devices list
        let [isSelected, store, iter] = this._deviceSelection.get_selected();

        if (!isSelected) {
            return;
        }

        let cardidSel = store.get_value(iter, 1);
        let profileidSel = store.get_value(iter, 2);

        if (cardid == cardidSel && profileid == profileidSel) {
            this._objects.btnAddDevice.set_sensitive(true);
        }
    },


    /**
     * Toggle event for quickswitch switches.
     */
    onQuickswitchToggled: function(widget, path) {
        let active = !widget.active;
        let [success, iter] = this._pinned.get_iter_from_string(path);
        if (!success) {
            return;
        }
        this._pinned.set_value(iter, 2, active);
        this._storePinned();
    },

    /**
     * Toggle event for display switches.
     */
    onDisplayToggled: function(widget, path) {
        let active = !widget.active;
        let [success, iter] = this._pinned.get_iter_from_string(path);
        if (!success) {
            return;
        }
        this._pinned.set_value(iter, 3, active);
        this._storePinned();
    }
});


function init() {
    preferences = new Preferences();
}

function buildPrefsWidget() {
    return preferences.buildWidget();
}