/**
 * Shell Volume Mixer
 *
 * Preferences widget.
 *
 * @author Alexander Hofbauer <alex@derhofbauer.at>
 */

/* exported init, buildPrefsWidget */

const { Gtk, GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Lib = ExtensionUtils.getCurrentExtension().imports.lib;
const __ = ExtensionUtils.gettext;

const { Settings, SETTING } = Lib.settings;
const Log = Lib.utils.log;
const PaHelper = Lib.utils.paHelper;
const Utils = Lib.utils.utils;

let preferences;


const WIDGETS = {
    cmbPosition:              SETTING.position,
    swRemoveOriginal:         SETTING.remove_original,
    swShowPercentageLabel:    SETTING.show_percentage_label,
    swShowDetailedSliders:    SETTING.show_detailed_sliders,
    swShowSystemSounds:       SETTING.show_system_sounds,
    swShowVirtualStreams:     SETTING.show_virtual_streams,
    swAlwaysShowInputStreams: SETTING.always_show_input_streams,
    swUseSymbolicIcons:       SETTING.use_symbolic_icons,
    txtProfileSwitch:         null,
    treeDevices:              null,
    treePinned:               null,
    btnAddDevice:             null,
    btnRemoveDevice:          null,
};


const Preferences = GObject.registerClass({
    Implements: [ Gtk.BuilderScope ],
}, class Preferences extends GObject.Object
{
    vfunc_create_closure(builder, handlerName, flags, connectObject) {
        if (flags & Gtk.BuilderClosureFlags.SWAPPED)
            throw new Error('Unsupported template signal flag "swapped"');

        if (typeof this[handlerName] === 'undefined')
            throw new Error(`${handlerName} is undefined`);

        return this[handlerName].bind(connectObject || this);
    }

    _getId(object) {
        for (const [id, widget] of Object.entries(this._widgets)) {
            if (widget === object) {
                return id;
            }
        }

        return null;
    }

    _getSetting(object) {
        const id = this._getId(object);

        if (id) {
            return this._widgetSettings[id] || null;
        }

        return null;
    }

    toggleBoolean(object) {
        const setting = this._getSetting(object);

        if (!setting) {
            Log.error('Preferences', 'toggleBoolean', new Error(`BUG! No widget found for toggle handler (${this._getId(object)})`));
            return;
        }

        const active = object.get_active();
        this._settings.set_boolean(setting, active);
    }

    /**
     * Callback for menu position combobox.
     *
     * @param cmbPosition
     */
    onPositionChanged(cmbPosition) {
        let value = cmbPosition.get_active();

        this._settings.set_enum(SETTING.position, value);

        let checkbox = this._widgets.swRemoveOriginal;
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
     * Callback for hotkey button entry.
     *
     * @param widget
     */
    onProfileSwitchChanged(widget) {
        let entry = widget.get_text().trim();

        if (!entry) {
            this._settings.set_array(SETTING.profile_switcher_hotkey, []);
            return;
        }

        try {
            let [ok, key, mods] = Gtk.accelerator_parse(entry);

            if (!ok || key === 0 || mods === 0) {
                return;
            }

            let hotkey = Gtk.accelerator_name(key, mods);
            if (hotkey) {
                widget.set_text(hotkey);

                // Main.wm.addKeybinding expects an array
                this._settings.set_array(SETTING.profile_switcher_hotkey, [hotkey]);
            }

        } catch (e) {
            Log.error('Preferences', 'onProfileSwitchChanged', e);
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

        if (cardid === cardidSel && profileid === profileidSel) {
            this._widgets.btnAddDevice.set_sensitive(true);
        }
    }

    /**
     * Callback for notebook tab selection.
     */
    onSwitchPage(page, pageNum) {
        if (this._hasCards || this._cardsWarningShown) {
            return;
        }

        if (pageNum === 1) {
            return;
        }

        this._showMessage(__('Error retrieving card details'),
            __('Helper script did not return valid card data.'));

        this._cardsWarningShown = true;
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

    /**
     * Determines whether selection allows to enable the remove button.
     */
    onPinnedSelectionChanged(selection) {
        if (selection.count_selected_rows() > 0) {
            this._widgets.btnRemoveDevice.set_sensitive(true);
        } else {
            this._widgets.btnRemoveDevice.set_sensitive(false);
        }
    }

    /**
     * Selection event for devices, before selection is set.
     */
    onDeviceSelection(selection, model, path) {
        return path && path.get_depth() >= 2;
    }

    /**
     * Determines whether selection allows to enable the add button.
     */
    onDeviceSelectionChanged(selection) {
        this._widgets.btnAddDevice.set_sensitive(false);

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

        this._widgets.btnAddDevice.set_sensitive(true);
    }



    _init() {
        super._init();

        ExtensionUtils.initTranslations();

        this._widgets = {};
        this._widgetSettings = [];

        this._settings = new Settings();

        this._builder = new Gtk.Builder();
        this._builder.set_scope(this);
    }

    buildWidget() {
        this._builder.add_from_file(Utils.getExtensionPath('prefs.ui'));

        this._tabs = this._builder.get_object('tabs');

        for (const [id, setting] of Object.entries(WIDGETS)) {
            const widget = this._builder.get_object(id);

            this._widgets[id]        = widget;
            this._widgetSettings[id] = setting;

            if (!setting) {
                continue;
            }

            if (widget instanceof Gtk.ComboBox
                || widget instanceof Gtk.ComboBoxText
            ) {
                widget.set_active(this._settings.get_enum(setting));
            } else if (widget instanceof Gtk.Switch) {
                widget.set_active(this._settings.get_boolean(setting));
            }
        }

        this._widgets.txtProfileSwitch.set_text(this._settings.get_array(SETTING.profile_switcher_hotkey)[0] || '');

        this._deviceSelection = this._widgets.treeDevices.get_selection();
        this._deviceSelection.set_select_function(this.onDeviceSelection.bind(this));
        this._deviceSelection.connect('changed', this.onDeviceSelectionChanged.bind(this));

        this._pinnedSelection = this._widgets.treePinned.get_selection();
        this._pinnedSelection.connect('changed', this.onPinnedSelectionChanged.bind(this));

        this._devices = this._builder.get_object('storeDevices');
        this._pinned  = this._builder.get_object('storePinned');

        (async () => {
            await this._initCards();
            this._populatePinned();
        })();

        this.onPositionChanged(this._widgets.cmbPosition);

        return this._tabs;
    }


    /**
     * Initializes the content of the cards / profiles selection tree.
     */
    async _initCards() {
        this._cards = {};
        let cards = await PaHelper.getCards();

        let details = this._widgets.swShowDetailedSliders.active;

        for (let k in cards) {
            let card = cards[k];
            let row = this._devices.append(null);
            this._devices.set(row, [0, 1, 2], [card.description, '', '']);

            let profiles = {};

            for (let p in card.profiles) {
                let profile = card.profiles[p];

                if (profile.name === 'off' || profile.available === false) {
                    continue;
                }

                let invalid = false;

                let test = profile.name.split('+');
                for (let parts of test) {
                    let [part] = parts.split(':', 1);
                    // profiles containing 'input' won't be accepted by Gvc
                    if (part === 'input') {
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

        this._widgets.treeDevices.expand_all();
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
            text:           title,
            secondary_text: text,
            message_type:   Gtk.MessageType[type],
            buttons:        Gtk.ButtonsType.OK,
            transient_for:  this._tabs.get_root(),
            modal:          true,
        });

        dialog.connect('response', () => {
            dialog.destroy();
        });

        dialog.show();
    }
});


function init() {
    preferences = new Preferences();
}

function buildPrefsWidget() {
    return preferences.buildWidget();
}
