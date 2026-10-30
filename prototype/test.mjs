// Explicit discovery works on Windows and avoids shell-specific glob expansion.
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = new URL('./tests/', import.meta.url);
const files = (await readdir(directory)).filter(name => name.endsWith('.test.mjs')).sort();
if (!files.length) throw new Error('No prototype tests found.');
const result = spawnSync(process.execPath,
  ['--test', ...files.map(name => fileURLToPath(new URL(name, directory)))],
  { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
