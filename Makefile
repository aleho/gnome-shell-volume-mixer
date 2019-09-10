VERSION = 0.17.2
EXTENSION = shell-volume-mixer@derhofbauer.at

SRCDIR = $(EXTENSION)
BUILDDIR = build/
PACKAGE = shell-volume-mixer-$(VERSION).zip

FILES = LICENSE README.md

LOCALES_SRC = $(foreach dir,$(SRCDIR)/locale,$(wildcard $(dir)/*/*/*.po))
LOCALES = $(patsubst %.po,%.mo,$(LOCALES_SRC))

SOURCES = \
	pautils/cardinfo.py \
	pautils/pa.py \
	lib/** \
	*.js \
	prefs.ui \
	stylesheet.css \
	$(LOCALES:$(SRCDIR)/%=%) \
	$(GSCHEMA) $(SCHEMA_COMP)

SCHEMA_COMP = schemas/gschemas.compiled
GSCHEMA = schemas/org.gnome.shell.extensions.shell-volume-mixer.gschema.xml

SRCFILES = $(addprefix $(SRCDIR)/, $(SOURCES) $(GSCHEMA) $(GSCHEMA_COMP))


dist: clean install-deps check package

package: $(PACKAGE)

$(SRCDIR)/$(SCHEMA_COMP): $(SRCDIR)/$(GSCHEMA)
	glib-compile-schemas --targetdir=$(SRCDIR)/schemas $(SRCDIR)/schemas

$(PACKAGE): i18n metadata.json $(SRCFILES) $(FILES)
	cd $(SRCDIR) && zip -r ../$(PACKAGE) $(SOURCES) 
	zip $(PACKAGE) $(FILES)
	cd $(BUILDDIR) && zip ../$(PACKAGE) *

i18n: $(LOCALES_SRC)
	@$(foreach file, $(LOCALES_SRC), msgfmt $(file) -o $(subst .po,.mo,$(file));)

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


.PHONY: clean i18n
