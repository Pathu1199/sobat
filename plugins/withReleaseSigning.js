const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with our own key instead of Android's shared debug
 * key. The android folder is generated, so this is applied on every prebuild
 * rather than edited by hand.
 *
 * The key is read from Gradle properties, which live outside the repo:
 *   SOBAT_RELEASE_STORE_FILE, SOBAT_RELEASE_KEY_ALIAS,
 *   SOBAT_RELEASE_STORE_PASSWORD, SOBAT_RELEASE_KEY_PASSWORD
 * On a machine without them, the build falls back to the debug key, so
 * anyone can still build and run the app.
 */
const PROP = 'SOBAT_RELEASE_STORE_FILE';

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('signingConfigs.release')) return config;

    // 1. A release signing config next to the debug one.
    contents = contents.replace(/signingConfigs \{\n(\s*)debug \{/, (match, indent) =>
      [
        'signingConfigs {',
        `${indent}release {`,
        `${indent}    if (project.hasProperty('${PROP}')) {`,
        `${indent}        storeFile file(${PROP})`,
        `${indent}        storePassword SOBAT_RELEASE_STORE_PASSWORD`,
        `${indent}        keyAlias SOBAT_RELEASE_KEY_ALIAS`,
        `${indent}        keyPassword SOBAT_RELEASE_KEY_PASSWORD`,
        `${indent}    }`,
        `${indent}}`,
        `${indent}debug {`,
      ].join('\n'),
    );

    // 2. The release build type uses it when the key is present.
    contents = contents.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('${PROP}') ? signingConfigs.release : signingConfigs.debug`,
    );

    if (!contents.includes('signingConfigs.release')) {
      throw new Error('withReleaseSigning: build.gradle did not have the expected signingConfigs block');
    }
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigning;
