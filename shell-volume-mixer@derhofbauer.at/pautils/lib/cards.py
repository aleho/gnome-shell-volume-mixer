# This file is part of GNOME Shell Volume Mixer
# Copyright (C) 2021 Alexander Hofbauer <alex@derhofbauer.at>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

from .pulseaudio import Pulseaudio
from . import log
from . import libpulse


class Cards(Pulseaudio):
    def build_callback(self):
        return libpulse.card_info_cb_t(self.pa_cb)

    def get_by_index(self, index, callback):
        return libpulse.context_get_card_info_by_index(self._context, index, callback, None)

    def get_by_name(self, name, callback):
        return libpulse.context_get_card_info_by_name(self._context, name, callback, None)

    def get_all(self, callback):
        return libpulse.context_get_card_info_list(self._context, callback, None)

    def cb_data(self, pa_card):
        card_name = pa_card.name.decode('utf8')

        try:
            alsa_card = libpulse.proplist_gets(pa_card.proplist, b'alsa.card')
            alsa_card = int(alsa_card.decode('utf8')) if alsa_card else None
        except Exception:
            log.debug('No property "alsa.card"')
            alsa_card = None

        try:
            description = libpulse.proplist_gets(pa_card.proplist, b'device.description')
            description = description.decode('utf8') if description else None
        except Exception:
            log.debug('No property "device.description"')
            description = None

        if not description:
            try:
                description = libpulse.proplist_gets(pa_card.proplist, b'alsa.card_name')
                description = description.decode('utf8') if description else None
            except Exception:
                log.debug('No property "alsa.card_name"')
                description = card_name

        card = {
            'index': pa_card.index,
            'alsaCard': alsa_card,
            'name': card_name,
            'description': description,
            'active_profile': None,
            'profiles': {
            },
            'ports': {
            },
        }

        if pa_card.active_profile and pa_card.active_profile[0]:
            ap = pa_card.active_profile[0]
            card['active_profile'] = ap.name.decode('utf8')

        for i in range(0, pa_card.n_profiles):
            if not pa_card.profiles2[i] or not pa_card.profiles2[i][0]:
                continue

            profile = pa_card.profiles2[i][0]
            name = profile.name.decode('utf8')

            card['profiles'][name] = {
                'name': name,
                'description': profile.description.decode('utf8'),
                'available': bool(profile.available),
            }

        for index in range(0, pa_card.n_ports):
            if not pa_card.ports[index] or not pa_card.ports[index][0]:
                continue

            port = pa_card.ports[index][0]
            name = port.name.decode('utf8')

            card['ports'][name] = {
                'name': name,
                'description': port.description.decode('utf8'),
                'direction': 'out' if port.direction == 1 else 'in',
                'available': True if port.available == 2 else (False if port.available == 1 else None),
            }

        return card
