VERSION = 3.38.2
EXTENSION = shell-volume-mixer@derhofbauer.at

SRCDIR = $(EXTENSION)
BUILDDIR = build/
PACKAGE = shell-volume-mixer-$(VERSION).zip

FILES = LICENSE README.md

LOCALE_DIR = $(SRCDIR)/locale
LOCALES_SRC = $(foreach dir,$(LOCALE_DIR),$(wildcard $(dir)/*/*/*.po))
LOCALES = $(patsubst %.po,%.mo,$(LOCALES_SRC))

SOURCES = \
	pautils/lib/*.py \
	pautils/query.py \
	lib/** \
	*.js \
	prefs.ui \
	stylesheet.css \
	$(LOCALES:$(SRCDIR)/%=%) \
	$(GSCHEMA) $(SCHEMA_COMP)

I18N = \
	*.js \
	lib/**/*.js \
	prefs.ui

SCHEMA_COMP = schemas/gschemas.compiled
GSCHEMA = schemas/org.gnome.shell.extensions.shell-volume-mixer.gschema.xml

SRCFILES = $(addprefix $(SRCDIR)/, $(SOURCES) $(GSCHEMA) $(GSCHEMA_COMP))


dist: clean build check package
build: install-deps i18n stylesheet.css
package: $(PACKAGE)

prepare:
	mkdir -p $(BUILDDIR)

install-deps:
	npm install
	git submodule update --init

$(SRCDIR)/$(SCHEMA_COMP): $(SRCDIR)/$(GSCHEMA)
	glib-compile-schemas --targetdir=$(SRCDIR)/schemas $(SRCDIR)/schemas

$(PACKAGE): metadata.json $(SRCFILES) $(FILES)
	cd $(SRCDIR) && zip -r ../$(PACKAGE) $(SOURCES)
	zip $(PACKAGE) $(FILES)
	cd $(BUILDDIR) && zip ../$(PACKAGE) *

i18n: $(LOCALES_SRC)
	@xgettext \
		--keyword --keyword=__ \
		--omit-header \
		--default-domain=$(EXTENSION) \
		--from-code=UTF-8 \
		--output=$(LOCALE_DIR)/translations.pot \
		 $(wildcard $(addprefix $(SRCDIR)/, $(I18N)))

metadata.json: prepare
	cat $(addprefix $(SRCDIR)/, metadata.json) | grep -v '"version":' > $(BUILDDIR)/metadata.json

stylesheet.css:
	node_modules/.bin/sass --no-source-map styles.scss $(SRCDIR)/stylesheet.css
	# remove harmful content produced by gnome-shell-sass
	sed -i '/\/\*\sGlobal\sValues\s\*\//,/\/\*\sCommon\sStylings\s\*/d' $(SRCDIR)/stylesheet.css

check:
	npm run eslint

clean:
	@test ! -d "$(BUILDDIR)" || rm -rf $(BUILDDIR)
	@test ! -f "$(SRCDIR)/$(SCHEMA_COMP)" || rm $(SRCDIR)/$(SCHEMA_COMP)
	@test ! -f "$(PACKAGE)" || rm $(PACKAGE)


.PHONY: clean i18n
