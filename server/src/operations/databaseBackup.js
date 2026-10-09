/** Encrypted, streaming database backups. Restore is restricted to empty disposable databases. */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');
const config = require('../config');
const { assertDisposableDatabase } = require('../services/disposableDatabaseGuard');
const magic = Buffer.from('FINTAP-BACKUP-1\n');
const command = process.argv[2];
const filename = process.argv[3];
const keyPath = process.env.BACKUP_KEY_FILE;
process.umask(0o077);
function child(program, args) {
  const process = spawn(program, args, {env:{...global.process.env,MYSQL_PWD:config.db.password},stdio:['pipe','pipe','pipe']});
  // Do not print database-client stderr: it may contain sensitive SQL or configuration.
  process.stderr.resume();
  const done = new Promise((resolve,reject)=>{
    process.once('error',reject);
    process.once('close',code=>code===0?resolve():reject(new Error(`${path.basename(program)} failed (exit ${code})`)));
  });
  done.catch(()=>{});
  return {process,done};
}
const connectionArgs = () => ['--protocol=TCP',`--host=${config.db.host}`,`--port=${config.db.port}`,`--user=${config.db.user}`];
async function main() {
  if (!keyPath) throw new Error('Set BACKUP_KEY_FILE to a protected key file kept independently of the server.');
  if (command === 'keygen') {
    await fsp.writeFile(keyPath,crypto.randomBytes(32),{mode:0o600,flag:'wx'});
    console.log('Backup key created. Preserve a separate protected copy; losing this key loses all backups.');
    return;
  }
  if (!['backup','verify','restore-disposable'].includes(command) || !filename) throw new Error('Usage: databaseBackup.js keygen | backup FILE | verify FILE | restore-disposable FILE');
  const stats = await fsp.stat(keyPath);
  if (stats.mode & 0o077) throw new Error('Backup key must be accessible only to its owner (0600).');
  const key = await fsp.readFile(keyPath);
  if (key.length !== 32) throw new Error('Backup key must contain exactly 32 bytes.');
  if (command === 'backup') {
    // Exclusive output avoids overwriting an earlier backup. Partial failures remove this file.
    const handle = await fsp.open(filename,'wx',0o600);
    let dump;
    try {
      const iv = crypto.randomBytes(12);
      await handle.write(Buffer.concat([magic,iv]));
      const cipher = crypto.createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(magic);
      dump = child(process.env.MYSQLDUMP_BIN || 'mysqldump',[
        ...connectionArgs(),'--single-transaction','--quick','--routines','--events','--triggers',
        '--hex-blob','--no-tablespaces','--set-gtid-purged=OFF',config.db.database]);
      dump.process.stdin.end();
      await Promise.all([pipeline(dump.process.stdout,zlib.createGzip(),cipher,handle.createWriteStream({autoClose:false})),dump.done]);
      await handle.write(cipher.getAuthTag());
      await handle.sync();
      console.log('Encrypted database backup completed. Off-server transfer and restore verification are separate steps.');
    } catch (err) {
      dump?.process.kill();
      await fsp.unlink(filename).catch(()=>{});
      throw err;
    } finally { await handle.close(); }
    return;
  }
  if (command === 'restore-disposable') assertDisposableDatabase(config,process.env.RESTORE_DATABASE_CONFIRM);
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(),'fintap-restore-'));
  try {
    const handle = await fsp.open(filename,'r');
    let decipher, size;
    try {
      size = (await handle.stat()).size;
      const header = Buffer.alloc(magic.length+12), tag = Buffer.alloc(16);
      if(size < header.length+16) throw new Error('Invalid backup');
      await handle.read(header,0,header.length,0);
      await handle.read(tag,0,16,size-16);
      if(!header.subarray(0,magic.length).equals(magic)) throw new Error('Unknown backup format');
      decipher=crypto.createDecipheriv('aes-256-gcm',key,header.subarray(magic.length));
      decipher.setAAD(magic); decipher.setAuthTag(tag);
    } finally { await handle.close(); }
    // Authenticate completely before allowing any SQL to run.
    const compressed=path.join(folder,'verified.sql.gz'),sql=path.join(folder,'verified.sql');
    await pipeline(fs.createReadStream(filename,{start:magic.length+12,end:size-17}),decipher,fs.createWriteStream(compressed,{mode:0o600,flags:'wx'}));
    await pipeline(fs.createReadStream(compressed),zlib.createGunzip(),fs.createWriteStream(sql,{mode:0o600,flags:'wx'}));
    if(command==='verify') { console.log('Backup authenticated and decompressed. A database restore drill is still required.'); return; }
    const mysql = require('mysql2/promise');
    const connection=await mysql.createConnection({host:config.db.host,port:config.db.port,user:config.db.user,password:config.db.password,database:config.db.database});
    try {
      const [tables]=await connection.query('SHOW TABLES');
      if(tables.length) throw new Error('Restore target must be empty; existing data will not be overwritten.');
    } finally { await connection.end(); }
    const restore=child(process.env.MYSQL_BIN || 'mysql',[...connectionArgs(),config.db.database]);
    restore.process.stdout.resume();
    try { await Promise.all([pipeline(fs.createReadStream(sql),restore.process.stdin),restore.done]); }
    catch(err) { restore.process.kill(); throw err; }
    console.log('Restored into the empty disposable database. Compare counts and run reconciliation before accepting this backup.');
  } finally { await fsp.rm(folder,{recursive:true,force:true}); }
}
main().catch(()=>{ console.error('Backup operation failed. Check paths, key permissions, database access, backup integrity, and disposable restore configuration.'); process.exitCode=1; });
