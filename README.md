GNOME Shell Volume Mixer
========================

![Screenshot of Volume Mixer](/screenshot.png?raw=true "Volume Mixer replacing the master volume slider")


Shell Volume Mixer is an extension for GNOME Shell allowing separate
configuration of PulseAudio devices and output switches. It features a profile
switcher to quickly switch between pinned profiles and devices.

Middle mouse click on a slider mutes the selected stream.


GNOME Settings Daemon (GSD)
---------------------------

GSD hardcodes the step for each key press of volume keys to 6. While this
might be OK for most people, some would prefer a configurable setting. There's
a bug in GNOME's tracker which, according to the comments by developers, won't
ever get fixed in a way that could allow configurable volume steps [1].

If you prefer such a solution you could patch GSD yourself using the
[patch](files/gsd-volume-steps.diff) provided in this repository. It applies
to and was tested with versions 3.12 and 3.14.

Shell Volume Mixer is able to integrate with this patch or use it's own
setting, though using the latter solution volume steps of media keys won't be
affected.

[1] https://bugzilla.gnome.org/show_bug.cgi?id=650371#c42


Acknowledgments
---------------

This is a fork of AdvancedVolumeMixer by Harry Karvonen
(git://repo.or.cz/AdvancedVolumeMixer.git).
Many thanks go out to him for his initial work.
