// Non-secret runtime selection. Credentials remain exclusively in the protected vault.
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { protectDirectory } from './vault.mjs';
import { ProviderError } from './errors.mjs';
function invalid() { throw new ProviderError('connection_invalid', 'Saved connection is invalid. Run connect-ssh to select an authorized account and model again.'); }
export function validateConnection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'accountId,model,version' || value.version !== 1 ||
    typeof value.accountId !== 'string' || !/^[0-9a-f]{16}$/.test(value.accountId) || typeof value.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value.model)) invalid();
  return { version: 1, accountId: value.accountId, model: value.model };
}
export async function loadConnection(dataDirectory) {
  const path = join(resolve(dataDirectory), 'connection.json');
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) invalid();
    const bytes = await readFile(path); if (bytes.length > 8192) invalid();
    let value; try { value = JSON.parse(bytes.toString('utf8')); } catch { invalid(); }
    return validateConnection(value);
  } catch (error) { if (error.code === 'ENOENT') return null; if (error instanceof ProviderError) throw error; throw new ProviderError('connection_unavailable', 'Cannot read saved connection. Check protected runtime permissions.'); }
}
export async function saveConnection(dataDirectory, selection) {
  const value = validateConnection(selection), directory = resolve(dataDirectory), path = join(directory, 'connection.json');
  await protectDirectory(directory);
  const existing = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) invalid();
  const temporary = path + '.' + randomUUID() + '.tmp';
  try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return value;
}
