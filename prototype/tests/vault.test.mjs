import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vault } from '../vault.mjs';
import { execFileSync } from 'node:child_process';

test('encrypted vault roundtrip excludes plaintext, rejects tampering and lost key, and serializes access', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'storychat-qa-'));
  const vault = new Vault(join(directory, 'credentials'), join(directory, 'key'));
  try {
    await vault.locked(async () => {
      if (process.platform === 'win32') {
        const script = '$d=New-Object System.IO.DirectoryInfo($env:STORYCHAT_QA_PATH); $a=$d.GetAccessControl(); $u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $rules=$a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]); if(!$a.AreAccessRulesProtected){exit 11}; foreach($r in $rules){if($r.IsInherited -or ($r.IdentityReference.Value -ne $u -and $r.IdentityReference.Value -ne "S-1-5-18")){exit 12}}; if($rules.Count -ne 2){exit 13}';
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          env: { ...process.env, STORYCHAT_QA_PATH: vault.directory }, windowsHide: true, stdio: 'pipe',
        });
      }
      const data = await vault.load();
      data.accounts.synthetic = { access_token: 'SYNTHETIC_SECRET_ACCESS', refresh_token: 'SYNTHETIC_SECRET_REFRESH' };
      await vault.save(data);
      assert.deepEqual(await vault.load(), data);
      const bytes = await readFile(vault.file);
      assert.ok(!bytes.includes(Buffer.from('SYNTHETIC_SECRET')));
      await assert.rejects(vault.locked(async () => {}), /locked by another process/);
      const corrupt = Buffer.from(bytes); corrupt[corrupt.length - 1] ^= 1;
      await writeFile(vault.file, corrupt);
      await assert.rejects(vault.load(), /Cannot decrypt/);
      await writeFile(vault.file, bytes);
      await unlink(vault.keyFile);
      await assert.rejects(vault.load(), /Vault key missing/);
      await assert.rejects(readFile(vault.keyFile), { code: 'ENOENT' });
    });
    // A failed action must release its process lock for recovery.
    await assert.rejects(vault.locked(async () => { throw Error('synthetic failure'); }), /synthetic failure/);
    await vault.locked(async () => {});
  } finally {
    // Both paths are children of the mkdtemp-created QA directory.
    await rm(directory, { recursive: true, force: true }).catch(error => {
      if (error.code !== 'EPERM') throw error;
      t.diagnostic('Sandbox could not remove protected synthetic QA directory; no real credentials were used.');
    });
  }
});
