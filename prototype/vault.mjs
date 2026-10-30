import { mkdir, readFile, writeFile, rename, unlink, chmod } from 'node:fs/promises';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { acquireRuntimeLock } from './runtime-lock.mjs';

async function protect(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    // Explicit DACL; remove inherited permissions. Paths are passed via environment, never interpolated into code.
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference="Stop"; $p=$env:STORYCHAT_PROTECT_PATH; $a=New-Object System.Security.AccessControl.DirectorySecurity; $a.SetAccessRuleProtection($true,$false); $u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; foreach($s in @($u,(New-Object System.Security.Principal.SecurityIdentifier("S-1-5-18")))){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,"FullControl","ContainerInherit,ObjectInherit","None","Allow");$a.AddAccessRule($r)}; $d=New-Object System.IO.DirectoryInfo($p); $d.SetAccessControl($a)'],
    { env: { ...process.env, STORYCHAT_PROTECT_PATH: directory }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  } else await chmod(directory, 0o700);
}
export { protect as protectDirectory };
export class Vault {
  constructor(dataDirectory, keyDirectory) {
    this.directory = resolve(dataDirectory); this.keyDirectory = resolve(keyDirectory);
    this.file = join(this.directory, 'credentials.enc'); this.keyFile = join(this.keyDirectory, 'vault.key');
  }
  async locked(action) {
    await protect(this.directory); await protect(this.keyDirectory);
    const lock = await acquireRuntimeLock(join(this.directory, '.lock'));
    try { return await action(); }
    finally { await lock.release(); }
  }
  async key() {
    try {
      const key = await readFile(this.keyFile);
      if (key.length !== 32) throw new Error('Invalid vault key.');
      return key;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Never replace a lost key for an existing encrypted vault.
      try { await readFile(this.file); throw new Error('Vault key missing; restore the original key.'); }
      catch (inner) { if (inner.code !== 'ENOENT') throw inner; }
      const key = randomBytes(32); await writeFile(this.keyFile, key, { flag: 'wx', mode: 0o600 }); return key;
    }
  }
  async load() {
    const key = await this.key();
    let encrypted;
    try { encrypted = await readFile(this.file); }
    catch (error) { if (error.code === 'ENOENT') return { version: 1, hostId: 'urn:uuid:' + randomUUID(), accounts: {} }; throw error; }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, encrypted.subarray(0, 12));
      decipher.setAuthTag(encrypted.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8'));
      if (data.version !== 1 || !data.hostId || !data.accounts) throw new Error();
      return data;
    } catch { throw new Error('Cannot decrypt or validate vault. Restore matching credentials and key.'); }
  }
  async save(data) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', await this.key(), iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try { await writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), bytes]), { flag: 'wx', mode: 0o600 }); await rename(temporary, this.file); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
