import { open, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { ProviderError } from './errors.mjs';

const locked = () => new ProviderError('runtime_locked', 'Runtime locked by another process. On Windows, if a process crashed, verify every process using this runtime is stopped before manually removing its lock file. Linux lock files are persistent and must not be deleted.');

/** One host/filesystem, one owner. Never unlink a Linux advisory-lock inode. */
export async function acquireRuntimeLock(path) {
  if (process.platform !== 'linux') {
    let handle;
    try { handle = await open(path, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw locked(); throw new ProviderError('runtime_permissions', 'Protected runtime lock path is inaccessible. Check owner permissions.'); }
    let released = false;
    return { async release() { if (released) return; released = true; await handle.close(); await unlink(path); } };
  }

  // The helper's stdin belongs only to this process. EOF after even SIGKILL ends
  // cat and releases flock. flock's child inherits its lock descriptor, including
  // if the wrapper exits first. Fixed shell program; the path is a separate argv.
  let file;
  try { file = await open(path, 'a', 0o600); await file.chmod(0o600); await file.close(); }
  catch { await file?.close().catch(() => {}); throw new ProviderError('runtime_permissions', 'Protected runtime lock path is inaccessible. Check owner permissions.'); }
  const helper = spawn('flock', ['--exclusive', '--nonblock', '--conflict-exit-code', '73', path, 'sh', '-c', 'printf "LOCKED\\n"; exec cat >/dev/null'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let expectedExit = false, acquired = false;
  helper.stdin.on('error', () => {});
  helper.stderr.resume();
  const exited = new Promise(resolve => { helper.once('exit', code => {
    if (acquired && !expectedExit) {
      // Continuing inference after losing exclusivity risks token rotation races.
      console.error('Protected runtime lock helper stopped unexpectedly. Stopping safely.');
      process.exit(1);
    }
    resolve(code);
  }); helper.once('error', () => resolve(null)); });
  await new Promise((resolve, reject) => {
    let output = '', finished = false;
    const timer = setTimeout(() => done(new ProviderError('runtime_lock_unavailable', 'Linux runtime lock helper did not start. Install util-linux flock and use local persistent storage.')), 5000);
    function done(error) {
      if (finished) return; finished = true; clearTimeout(timer);
      if (error) { expectedExit = true; helper.stdin.destroy(); reject(error); }
      else { acquired = true; resolve(); }
    }
    helper.stdout.on('data', chunk => { output += chunk.toString('utf8'); if (output === 'LOCKED\n') done(); else if (output.length > 32) done(new ProviderError('runtime_lock_unavailable', 'Linux runtime lock helper returned invalid startup data.')); });
    helper.once('error', () => done(new ProviderError('runtime_lock_unavailable', 'Linux locking requires util-linux flock in PATH. Install it before starting Storychat.')));
    helper.once('exit', code => done(code === 73 ? locked() : new ProviderError('runtime_permissions', 'Linux runtime lock could not be acquired. Check flock availability and persistent-volume permissions.')));
  });
  let releasing;
  return { release() {
    if (releasing) return releasing;
    expectedExit = true;
    releasing = (async () => { helper.stdin.end(); await exited; })();
    return releasing;
  } };
}
