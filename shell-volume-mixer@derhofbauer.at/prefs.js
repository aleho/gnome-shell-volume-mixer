/**
 * Shell Volume Mixer
 *
 * Preferences widget.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init, buildPrefsWidget */

const Gtk = imports.gi.Gtk;
const Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;

const Gettext = Lib.utils.gettext;
const { Settings, SETTING } = Lib.settings;
const Log = Lib.utils.log;
const PaHelper = Lib.utils.paHelper;
const Utils = Lib.utils.utils;
const __ = Lib.utils.gettext._;

let preferences;


const Preferences = class
{
    constructor() {
        this._objects = {
            tabs: null,
            cmbPosition: null,
            swRemoveOriginal: null,
            swShowPercentageLabel: null,
            swShowDetailedSliders: null,
            swShowSystemSounds: null,
            swShowVirtualStreams: null,
            swAlwaysShowInputStreams: null,
            swUseSymbolicIcons: null,
            txtProfileSwitch: null,
            treeDevices: null,
            treePinned: null,
            btnAddDevice: null,
            btnRemoveDevice: null,
            rndQuickswitch: null,
            rndDisplay: null
        };

        // just init gettext here
        Gettext.getLocal();
        this._settings = new Settings();
    }

    buildWidget() {
        this.builder = new Gtk.Builder();
        this.builder.add_from_file(Utils.getExtensionPath('prefs.ui'));

        this._devices = this.builder.get_object('storeDevices');
        this._pinned = this.builder.get_object('storePinned');

        this._connectAndInitUi();

        (async () => {
            await this._initCards();
            this._populatePinned();
        })();

        this._widget = this._objects.tabs;
        return this._widget;
    }

    _connectAndInitUi() {
        for (let k in this._objects) {
            this._objects[k] = this.builder.get_object(k);
        }

        this._deviceSelection = this._objects.treeDevices.get_selection();
        this._deviceSelection.set_select_function(this.onDeviceSelection.bind(this));
        this._deviceSelection.connect('changed', this.onDeviceSelectionChanged.bind(this));

        this._pinnedSelection = this._objects.treePinned.get_selection();
        this._pinnedSelection.connect('changed', this.onPinnedSelectionChanged.bind(this));

        this._objects.rndQuickswitch.connect('toggled', this.onQuickswitchToggled.bind(this));
        this._objects.rndDisplay.connect('toggled', this.onDisplayToggled.bind(this));

        this._objects.cmbPosition.set_active(this._settings.get_enum(SETTING.position));
        this._objects.swRemoveOriginal.set_active(this._settings.get_boolean(SETTING.remove_original));
        this._objects.swShowPercentageLabel.set_active(this._settings.get_boolean(SETTING.show_percentage_label));
        this._objects.swShowDetailedSliders.set_active(this._settings.get_boolean(SETTING.show_detailed_sliders));
        this._objects.swShowSystemSounds.set_active(this._settings.get_boolean(SETTING.show_system_sounds));
        this._objects.swShowVirtualStreams.set_active(this._settings.get_boolean(SETTING.show_virtual_streams));
        this._objects.swAlwaysShowInputStreams.set_active(this._settings.get_boolean(SETTING.always_show_input_streams));
        this._objects.swUseSymbolicIcons.set_active(this._settings.get_boolean(SETTING.use_symbolic_icons));
        this._objects.txtProfileSwitch.set_text(this._settings.get_array(SETTING.profile_switcher_hotkey)[0] || '');

        this._bindSignal('tabs', 'switch-page', this.onSwitchPage);
        this._bindSignal('cmbPosition', 'changed', this.onPositionChanged, SETTING.position);
        this._bindSignal('swRemoveOriginal', 'notify::active', this.onSwitchActivate, SETTING.remove_original);
        this._bindSignal('swShowPercentageLabel', 'notify::active', this.onSwitchActivate, SETTING.show_percentage_label);
        this._bindSignal('swShowDetailedSliders', 'notify::active', this.onSwitchActivate, SETTING.show_detailed_sliders);
        this._bindSignal('swShowSystemSounds', 'notify::active', this.onSwitchActivate, SETTING.show_system_sounds);
        this._bindSignal('swShowVirtualStreams', 'notify::active', this.onSwitchActivate, SETTING.show_virtual_streams);
        this._bindSignal('swAlwaysShowInputStreams', 'notify::active', this.onSwitchActivate, SETTING.always_show_input_streams);
        this._bindSignal('swUseSymbolicIcons', 'notify::active', this.onSwitchActivate, SETTING.use_symbolic_icons);
        this._bindSignal('txtProfileSwitch', 'changed', this.onProfileSwitchChanged, SETTING.profile_switcher_hotkey);
        this._bindSignal('btnAddDevice', 'clicked', this.onAddDevice);
        this._bindSignal('btnRemoveDevice', 'clicked', this.onRemoveDevice);

        this.onPositionChanged(this._objects.cmbPosition);
    }


    /**
     * Initializes the content of the cards / profiles selection tree.
     */
    async _initCards() {
        this._cards = {};
        let cards = await PaHelper.getCards();

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
                    profiletext += `\n${profile.name}`;
                }

                this._devices.set(this._devices.append(row), [0, 1, 2],
                    [profiletext, card.name, profile.name]);

                profiles[profile.name] = {
                    description: profile.description,
                    pinned: false
                };
            }

            this._hasCards = true;

            this._cards[card.name] = {
                description: card.description,
                profiles: profiles
            };
        }

        this._objects.treeDevices.expand_all();
    }

    /**
     * Updates the content of the selection list with all values from the
     * settings key.
     */
    _populatePinned() {
        let pinned = this._settings.get_array(SETTING.pinned_profiles);
        this._pinned.clear();

        for (let item of pinned) {
            if (!item) {
                continue;
            }
            let entry = null;
            try {
                entry = JSON.parse(item);
            } catch (e) {
                Log.error('Preferences', '_populatePinned', e);
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
    }

    /**
     * Returns the entries in the selection list as array of strings.
     */
    _storePinned() {
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

        this._settings.set_array(SETTING.pinned_profiles, values);
    }


    /**
     * Shows a message dialog bound to the parent window.
     */
    _showMessage(title, text, type = 'WARNING') {
        let dialog = new Gtk.MessageDialog({
            text: title,
            secondary_text: text,
            message_type: Gtk.MessageType[type],
            buttons: Gtk.ButtonsType.OK,
            transient_for: this._widget.get_toplevel(),
            modal: true
        });

        dialog.connect('response', () => {
            dialog.destroy();
        });
        dialog.show();
    }


    /**
     * Binds a signal to an object, passing the object and additionally the
     * settings key to the callback.
     *
     * @param {number} id Object, identified by id.
     * @param {string} signal
     * @param {function} callback
     * @param {string} setting Key in settings, passed to the callback.
     */
    _bindSignal(id, signal, callback, setting) {
        this._objects[id].connect(signal, widget => {
            callback.apply(this, [widget, setting]);
        });
    }


    /**
     * Callback for notebook tab selection.
     */
    onSwitchPage(tabs) {
        if (this._hasCards || this._cardsWarningShown) {
            return;
        }

        let curr = tabs.get_current_page();

        if (curr == 1) {
            return;
        }

        this._showMessage(__('Error retrieving card details'),
            __('Helper script did not return valid card data.'));

        this._cardsWarningShown = true;
    }

    /**
     * Callback for change event of combobox.
     */
    onPositionChanged(cmbPosition, setting) {
        let value = cmbPosition.get_active();

        if (setting) {
            this._settings.set_enum(setting, value);
        }

        let checkbox = this._objects.swRemoveOriginal;
        if (!checkbox) {
            return;
        }

        if (value === SETTING.position_at.menu) {
            checkbox.set_sensitive(false);
        } else {
            checkbox.set_sensitive(true);
        }
    }

    /**
     * Callback for all switches.
     */
    onSwitchActivate(widget, setting) {
        this._settings.set_boolean(setting, widget.active);
    }

    /**
     * Callback for change event of profile switcher hotkey.
     */
    onProfileSwitchChanged(widget, setting) {
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
    }


    /**
     * Selection event for devices, before selection is set.
     */
    onDeviceSelection(selection, model, path) {
        if (!path || path.get_depth() < 2) {
            return false;
        }

        return true;
    }

    /**
     * Determines whether selection allows to enable the add button.
     */
    onDeviceSelectionChanged(selection) {
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
    }

    /**
     * Determines whether selection allows to enable the remove button.
     */
    onPinnedSelectionChanged(selection) {
        if (selection.count_selected_rows() > 0) {
            this._objects.btnRemoveDevice.set_sensitive(true);
        } else {
            this._objects.btnRemoveDevice.set_sensitive(false);
        }
    }


    /**
     * Callback for add button.
     */
    onAddDevice(widget) {
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
    }

    /**
     * Callback for remove button.
     */
    onRemoveDevice() {
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
        [isSelected, store, iter] = this._deviceSelection.get_selected();

        if (!isSelected) {
            return;
        }

        let cardidSel = store.get_value(iter, 1);
        let profileidSel = store.get_value(iter, 2);

        if (cardid == cardidSel && profileid == profileidSel) {
            this._objects.btnAddDevice.set_sensitive(true);
        }
    }


    /**
     * Toggle event for quickswitch switches.
     */
    onQuickswitchToggled(widget, path) {
        let active = !widget.active;
        let [success, iter] = this._pinned.get_iter_from_string(path);
        if (!success) {
            return;
        }
        this._pinned.set_value(iter, 2, active);
        this._storePinned();
    }

    /**
     * Toggle event for display switches.
     */
    onDisplayToggled(widget, path) {
        let active = !widget.active;
        let [success, iter] = this._pinned.get_iter_from_string(path);
        if (!success) {
            return;
        }
        this._pinned.set_value(iter, 3, active);
        this._storePinned();
    }
};


function init() {
    preferences = new Preferences();
}

function buildPrefsWidget() {
    return preferences.buildWidget();
}
