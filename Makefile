
VERSION=0.14
PKG=AdvancedVolumeMixer@harry.karvonen.gmail.com
JSON=metadata.json
JS=extension.js  lib.js  mixer.js  panel.js  prefs.js  settings.js  widget.js
SCHEMA_COMP=schemas/gschemas.compiled
GSCHEMA=schemas/org.gnome.shell.extensions.AdvancedVolumeMixer.gschema.xml

deploy: AdvancedVolumeMixer-$(VERSION).zip

$(SCHEMA_COMP): $(GSCHEMA)
	glib-compile-schemas --targetdir=schemas schemas

AdvancedVolumeMixer-$(VERSION).zip: $(JSON) $(JS) stylesheet.css $(SCHEMA_COMP) $(GSCHEMA)
	zip AdvancedVolumeMixer-$(VERSION).zip $(JSON) $(JS) stylesheet.css $(SCHEMA_COMP) $(GSCHEMA)

