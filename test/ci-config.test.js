'use strict';
// Regression test for the v2.10.12 CI failure.
//
// The Android job ran `flutter create --platforms=android` and then generated
// launcher icons from a config with `ios: true`. flutter_launcher_icons tried to
// write ios/Runner/Assets.xcassets/... , which that job never creates, threw
// PathNotFoundException and exited 255 -- so the APK was never built.
//
// Icon generation only works when the config's target platforms are a subset of
// the platforms the same job created. That invariant is what this test enforces,
// statically, without needing Flutter or a runner.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WF = path.join(ROOT, '.github/workflows');
const MOBILE = path.join(ROOT, 'mobile');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (detail ? ' -- ' + detail : '')); }
}

console.log('[ci config]');

// Reads the `flutter_launcher_icons:` block out of a YAML file and returns which
// platforms it targets. Only the two booleans matter here, so a full YAML parser
// (an extra dependency) would be overkill.
function iconPlatforms(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^flutter_launcher_icons:\s*$/.test(l));
  if (start === -1) return null;
  const out = {};
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l) && l.trim() !== '') break; // dedented: block is over
    const m = /^\s+(android|ios):\s*(true|false)\s*$/.exec(l);
    if (m) out[m[1]] = m[2] === 'true';
  }
  return out;
}

const workflows = fs.readdirSync(WF).filter((f) => /\.ya?ml$/.test(f));
check('workflow files are present', workflows.length > 0);

for (const wf of workflows) {
  const text = fs.readFileSync(path.join(WF, wf), 'utf8');

  // Split into jobs so platforms created in one job are not credited to another.
  const jobBlocks = text.split(/\n  (?=[a-zA-Z0-9_-]+:\n)/);

  for (const block of jobBlocks) {
    const iconRuns = block.match(/flutter_launcher_icons[^\n]*/g);
    if (!iconRuns) continue;

    const created = [];
    const cm = block.match(/flutter create[^\n]*--platforms=([a-z,]+)/);
    if (cm) created.push(...cm[1].split(','));

    for (const run of iconRuns) {
      // Which config does this invocation use?
      const fm = /-f\s+(\S+)/.exec(run);
      const configFile = fm ? path.join(MOBILE, fm[1]) : path.join(MOBILE, 'pubspec.yaml');
      const label = wf + ' -> ' + (fm ? fm[1] : 'pubspec.yaml');

      if (!fs.existsSync(configFile)) {
        check('icon config exists for ' + label, false, configFile + ' is missing');
        continue;
      }
      check('icon config exists for ' + label, true);

      const want = iconPlatforms(configFile);
      if (!want) { check('icon config declares a block: ' + label, false); continue; }

      // The actual invariant: never ask for a platform this job did not create.
      for (const plat of ['android', 'ios']) {
        if (want[plat] === true) {
          check(label + ': targets ' + plat + ' and the job creates ' + plat,
            created.includes(plat),
            'job creates [' + created.join(',') + '] -- this is exactly what broke the v2.10.12 build');
        }
      }
    }
  }
}

// The iOS artifact must not silently ship with the stock Flutter icon.
const release = fs.readFileSync(path.join(WF, 'mobile-release.yml'), 'utf8');
const iosJob = release.slice(release.indexOf('\n  ios:'));
check('the iOS job generates its own launcher icon', iosJob.includes('flutter_launcher_icons'));
check('iOS icon config file is committed', fs.existsSync(path.join(MOBILE, 'ios_launcher_icons.yaml')));

// Second regression, build #19. flutter_launcher_icons scans the project for
// `flutter_launcher_icons-<name>.yaml` and silently treats each match as a build
// FLAVOR, running it on EVERY invocation. A file named
// flutter_launcher_icons-ios.yaml therefore executed inside the Android job,
// which printed "Flavor: ios" and died on ios/Runner.xcodeproj/project.pbxproj.
// Any extra icon config must stay outside that reserved filename pattern.
const FLAVOR_PATTERN = /^flutter_launcher_icons-.*\.ya?ml$/;
const accidentalFlavors = fs.readdirSync(MOBILE).filter((f) => FLAVOR_PATTERN.test(f));
check('no icon config uses the reserved flavor filename pattern',
  accidentalFlavors.length === 0,
  accidentalFlavors.join(', ') + ' would be auto-run as a flavor in every job');

// App Store review rejects icons that keep an alpha channel.
const iosCfg = fs.readFileSync(path.join(MOBILE, 'ios_launcher_icons.yaml'), 'utf8');
check('iOS icon flattens transparency', /remove_alpha_ios:\s*true/.test(iosCfg));

// Deprecated runner images are a slow-motion outage: pin to supported majors.
for (const wf of workflows) {
  const text = fs.readFileSync(path.join(WF, wf), 'utf8');
  check(wf + ': no deprecated actions/checkout@v4', !text.includes('actions/checkout@v4'));
  check(wf + ': no deprecated actions/setup-java@v4', !text.includes('actions/setup-java@v4'));
  check(wf + ': no deprecated actions/setup-node@v4', !text.includes('actions/setup-node@v4'));
}

// Every icon config must point at assets that are actually committed.
for (const cfg of ['pubspec.yaml', 'ios_launcher_icons.yaml']) {
  const text = fs.readFileSync(path.join(MOBILE, cfg), 'utf8');
  const paths = [...text.matchAll(/(?:image_path|adaptive_icon_foreground):\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const p of paths) {
    check(cfg + ': asset exists -> ' + p, fs.existsSync(path.join(MOBILE, p)));
  }
}

// The build must not fail after a successful compile for want of an artifact.
for (const wf of workflows) {
  const text = fs.readFileSync(path.join(WF, wf), 'utf8');
  if (text.includes('upload-artifact')) {
    check(wf + ': artifact upload fails loudly if nothing was built',
      text.includes('if-no-files-found: error'));
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
