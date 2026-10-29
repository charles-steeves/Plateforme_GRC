/**
 * Full restore test is CI-ONLY: it replaces images in the ephemeral checkout.
 * It NEVER runs on the user's PC via ordinary local test commands.
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

if (process.env.CI !== 'true') {
  console.log('NON EXECUTE — full restore runs only in disposable GitHub Actions workspace');
  process.exit(0);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'grc-backup-'));
const dbFolder = join(tmp, 'local');
const database = join(dbFolder, 'grc.sqlite');
const bundle = join(tmp, 'archive');
const images = join(root, 'public', 'assets', 'images', 'uploads');
const imageName = 'e'.repeat(32) + '.png';
const photoPath = join(images, imageName);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS8cAAAAASUVORK5CYII=', 'base64');
function call(args, success = true) {
  const result = spawnSync('php', args, {
    cwd: root, env: { ...process.env, GRC_DB_PATH: database }, encoding: 'utf8', timeout: 45000,
  });
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'Expected command to refuse unsafe operation');
  return result;
}
try {
  mkdirSync(dbFolder);
  mkdirSync(images, { recursive: true });
  // The only image created by the test is a known unused CI-only filename.
  assert.equal(existsSync(photoPath), false);
  writeFileSync(photoPath, png);
  call(['database/init.php', '--db=' + database]);
  const initial = readFileSync(join(dbFolder, 'demo-accounts.json'), 'utf8');
  call(['database/backup-bundle.php', '--to=' + bundle]);
  assert.ok(existsSync(join(bundle, 'grc.sqlite')));
  assert.ok(existsSync(join(bundle, 'demo-accounts.json')));
  assert.ok(existsSync(join(bundle, 'uploads', imageName)));
  const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
  assert.equal(manifest.format, 'grc-bundle-v1');
  assert.ok(manifest.files['uploads/' + imageName]);
  call(['database/backup-bundle.php', '--to=' + bundle], false);
  call(['database/restore-bundle.php', '--from=' + bundle], false);
  call(['database/init.php', '--db=' + database, '--reset']);
  assert.notEqual(readFileSync(join(dbFolder, 'demo-accounts.json'), 'utf8'), initial);
  rmSync(photoPath);
  call(['database/restore-bundle.php', '--from=' + bundle, '--replace', '--confirm']);
  assert.equal(readFileSync(join(dbFolder, 'demo-accounts.json'), 'utf8'), initial);
  assert.ok(existsSync(photoPath));
  console.log('OK — private SQLite + credentials + photo backup and guarded restore on isolated DB in CI');
} finally {
  if (existsSync(photoPath)) rmSync(photoPath);
  rmSync(tmp, { recursive: true, force: true });
}
