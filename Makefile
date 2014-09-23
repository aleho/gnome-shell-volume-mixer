VERSION = 0.2.1
EXTENSION = shell-volume-mixer@derhofbauer.at

SRCDIR = $(EXTENSION)
PACKAGE = shell-volume-mixer-$(VERSION).zip

FILES = LICENSE README.md

SOURCES =  \
	metadata.json \
	extension.js \
	mixer.js \
	panel.js \
	prefs.js \
	settings.js \
	widget.js \
	stylesheet.css \
	$(GSCHEMA) $(SCHEMA_COMP)

SCHEMA_COMP = schemas/gschemas.compiled
GSCHEMA = schemas/org.gnome.shell.extensions.shell-volume-mixer.gschema.xml


SRCFILES = $(addprefix $(SRCDIR)/, $(SOURCES) $(GSCHEMA) $(GSCHEMA_COMP))

dist: clean $(PACKAGE)

$(SRCDIR)/$(SCHEMA_COMP): $(SRCDIR)/$(GSCHEMA)
	glib-compile-schemas --targetdir=$(SRCDIR)/schemas $(SRCDIR)/schemas

$(PACKAGE): $(SRCFILES) $(FILES)
	cd $(SRCDIR) && zip ../$(PACKAGE) $(SOURCES)
	zip $(PACKAGE) $(FILES)

clean:
	-@rm $(SRCDIR)/$(SCHEMA_COMP) 2>/dev/null
	-@rm $(PACKAGE) 2>/dev/null

.PHONY: clean
