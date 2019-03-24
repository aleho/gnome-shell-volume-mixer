VERSION = 0.16.1
EXTENSION = shell-volume-mixer@derhofbauer.at

SRCDIR = $(EXTENSION)
BUILDDIR = build/
PACKAGE = shell-volume-mixer-$(VERSION).zip

FILES = LICENSE README.md

SOURCES = \
	locale/*/*/*.mo \
	pautils/cardinfo.py \
	pautils/pa.py \
	lib/** \
	*.js \
	prefs.ui \
	stylesheet.css \
	$(GSCHEMA) $(SCHEMA_COMP)

SCHEMA_COMP = schemas/gschemas.compiled
GSCHEMA = schemas/org.gnome.shell.extensions.shell-volume-mixer.gschema.xml

SRCFILES = $(addprefix $(SRCDIR)/, $(SOURCES) $(GSCHEMA) $(GSCHEMA_COMP))


dist: clean install-deps check package

package: $(PACKAGE)

$(SRCDIR)/$(SCHEMA_COMP): $(SRCDIR)/$(GSCHEMA)
	glib-compile-schemas --targetdir=$(SRCDIR)/schemas $(SRCDIR)/schemas

$(PACKAGE): $(SRCFILES) $(FILES) metadata.json
	cd $(SRCDIR) && zip -r ../$(PACKAGE) $(SOURCES)
	zip $(PACKAGE) $(FILES)
	cd $(BUILDDIR) && zip ../$(PACKAGE) *

metadata.json: prepare
	cat $(addprefix $(SRCDIR)/, metadata.json) | grep -v '"version":' > $(BUILDDIR)/metadata.json

install-deps:
	npm install

check: install-deps
	node_modules/.bin/eslint $(SRCDIR)

prepare:
	mkdir -p $(BUILDDIR)

clean:
	@test ! -d "$(BUILDDIR)" || rm -rf $(BUILDDIR)
	@test ! -f "$(SRCDIR)/$(SCHEMA_COMP)" || rm $(SRCDIR)/$(SCHEMA_COMP)
	@test ! -f "$(PACKAGE)" || rm $(PACKAGE)


.PHONY: clean
