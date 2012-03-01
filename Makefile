
VERSION=0.1
PKG=AdvancedVolumeMixer@harry.karvonen.gmail.com

deploy: AdvancedVolumeMixer-$(VERSION).zip

AdvancedVolumeMixer-$(VERSION).zip: metadata.json extension.js
	zip AdvancedVolumeMixer-$(VERSION).zip metadata.json extension.js

