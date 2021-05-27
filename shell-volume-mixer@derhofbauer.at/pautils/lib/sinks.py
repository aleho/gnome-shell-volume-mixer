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


class Sinks(Pulseaudio):
    def build_callback(self):
        return libpulse.sink_info_cb_t(self.pa_cb)

    def get_by_index(self, index, callback):
        return libpulse.context_get_sink_info_by_index(self._context, index, callback, None)

    def get_by_name(self, name, callback):
        return libpulse.context_get_sink_info_by_name(self._context, name, callback, None)

    def get_all(self, callback):
        return libpulse.context_get_sink_info_list(self._context, callback, None)

    def cb_data(self, pa_sink):
        sink_name = pa_sink.name.decode('utf8')
        description = pa_sink.description.decode('utf8')

        if not description:
            try:
                description = libpulse.proplist_gets(pa_sink.proplist, b'device.description')
                description = description.decode('utf8') if description else None
            except Exception:
                log.debug('No property "device.description"')
                description = sink_name

        try:
            alsa_card = libpulse.proplist_gets(pa_sink.proplist, b'alsa.card')
            alsa_card = int(alsa_card.decode('utf8')) if alsa_card else None
        except Exception:
            log.debug('No property "alsa.card"')
            alsa_card = None

        sink = {
            'index': pa_sink.index,
            'alsaCard': alsa_card,
            'name': sink_name,
            'description': description,
            'card': pa_sink.card if pa_sink.card != libpulse.NULL_ID else None,
            'active_port': None,
            'ports': {
            },
        }

        if pa_sink.active_port and pa_sink.active_port[0]:
            ap = pa_sink.active_port[0]
            sink['active_port'] = ap.name.decode('utf8')

        for index in range(0, pa_sink.n_ports):
            if not pa_sink.ports[index] or not pa_sink.ports[index][0]:
                continue

            port = pa_sink.ports[index][0]
            name = port.name.decode('utf8')

            sink['ports'][name] = {
                'name': name,
                'description': port.description.decode('utf8'),
                'type': port.type,
                'available': True if port.available == 2 else (False if port.available == 1 else None),
            }

        return sink
