GNOME Shell Volume Mixer
========================


Shell Volume Mixer is an extension for GNOME Shell allowing separate
configuration of PulseAudio devices and output switches. It features a profile
switcher to quickly switch between pinned profiles and devices.

Middle mouse click on a slider mutes the selected stream.


<img src="/screenshot_1.png" alt="Outputs menu" width="40%"><img alt="Inputs menu" src="/screenshot_2.png" width="40%">


Requirements
------------

- PulseAudio (for retrieval of card details)
- gettext (for building of language files)
- nodejs / npm (styles and linting)
- glib2 bin (schema compilation)


Installation
------------

```
$ make
```

That's it. Add the resulting archive via GNOME Tweak Tool (extensions tab) or
copy it's content manually to
".~/.local/share/gnome-shell/extensions/shell-volume-mixer@derhofbauer.at".


Volume Steps
------------


GNOME Settings Daemon (GSD) hardcodes the step for each key press of volume keys
to 6% of maximum. While this might be OK for most people, some would prefer a
configurable setting. There's a bug in GNOME's tracker which, according to the
comments by developers, won't ever get fixed in a way that could allow
configurable volume
steps<sup>[[1]](https://bugzilla.gnome.org/show_bug.cgi?id=650371)</sup>.

Shell Volume Mixer tried to grab GSD's hotkeys to provide configurable steps
for sliders and media keys in the past, but at some point this stopped working.

GNOME's current solution to the problem is Shift + Key, i.e. hold down the shift
button to switch to a 2% step.


Acknowledgments
---------------

This is a fork of AdvancedVolumeMixer by Harry Karvonen
(git://repo.or.cz/AdvancedVolumeMixer.git).
Many thanks go out to him for his initial work.
