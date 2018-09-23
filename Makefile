VERSION = 0.15.0
EXTENSION = shell-volume-mixer@derhofbauer.at

SRCDIR = $(EXTENSION)
PACKAGE = shell-volume-mixer-$(VERSION).zip

FILES = LICENSE README.md

SOURCES = \
	locale/*/*/*.mo \
	pautils/cardinfo.py \
	pautils/pa.py \
	lib/*.js \
	*.js \
	metadata.json \
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

$(PACKAGE): $(SRCFILES) $(FILES)
	cd $(SRCDIR) && zip -r ../$(PACKAGE) $(SOURCES)
	zip $(PACKAGE) $(FILES)

install-deps:
	npm install

check: install-deps
	node_modules/.bin/eslint $(SRCDIR)

clean:
	@test ! -f "$(SRCDIR)/$(SCHEMA_COMP)" || rm $(SRCDIR)/$(SCHEMA_COMP)
	@test ! -f "$(PACKAGE)" || rm $(PACKAGE)


.PHONY: clean
