import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory=fileURLToPath(new URL('./tests/',import.meta.url));
const files=readdirSync(directory).filter(file=>file.endsWith('.test.mjs')).map(file=>directory+file);
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exitCode=result.status ?? 1;
