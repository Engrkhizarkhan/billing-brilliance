const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const source = fs.readFileSync(path.resolve(__dirname,'../../../deploy/fintap-github-deploy'),'utf8');
const revision='a'.repeat(40);
let directory;
afterEach(()=>{if(directory)fs.rmSync(directory,{recursive:true,force:true});});
const execute = (failure='') => {
  directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'fintap-deploy-test-')));
  fs.symlinkSync(process.execPath,path.join(directory,'runtime'));
  const app=path.join(directory,'app'), old=path.join(directory,'old'), bin=path.join(directory,'bin');
  for(const name of ['old/server','repository','bin','artifact/server']) fs.mkdirSync(path.join(directory,name),{recursive:true});
  fs.writeFileSync(path.join(directory,'artifact/server/ecosystem.config.cjs'),'module.exports={}');
  fs.writeFileSync(path.join(directory,'environment'),'NODE_ENV=production');
  fs.symlinkSync(old,app);
  const tar=spawnSync('tar',['-cf',path.join(directory,'artifact.tar'),'-C',path.join(directory,'artifact'),'.']);
  if(tar.status!==0)throw new Error(tar.stderr.toString());
  // Controlled stand-ins exercise the actual shell control flow, not real PM2,
  // npm, databases or network. The original script is never modified.
  const stub=`#!/usr/bin/env node
const fs=require('fs'),path=require('path');const args=process.argv.slice(2),cmd=path.basename(process.argv[1]),root=process.env.DEPLOY_TEST_ROOT;
if(cmd==='git'&&args.includes('archive'))process.stdout.write(fs.readFileSync(root+'/artifact.tar'));
if(cmd==='npm'&&process.env.FAIL_STAGE==='build'&&args.includes('build'))process.exit(17);
if(cmd==='node'){
 if(args.includes('server/src/db/migrate.js')){fs.writeFileSync(root+'/migration-ran','yes');if(process.env.FAIL_STAGE==='migration')process.exit(18);}
 else {const p=require('child_process').spawnSync(process.execPath,args,{stdio:'inherit'});process.exit(p.status??1);}
}
if(cmd==='curl'){process.stdout.write(JSON.stringify({status:'ready',revision:process.env.FAIL_STAGE==='ready'?'wrong':process.env.TEST_REVISION}));}
if(cmd==='pm2'){
 if(args[0]==='startOrReload')process.exit(19);
 if(args[0]==='start')fs.writeFileSync(root+'/process-cwd',path.dirname(args[1]));
 if(args[0]==='jlist'){const cwd=fs.readFileSync(root+'/process-cwd','utf8');process.stdout.write(JSON.stringify(['Fintap-api-backend','Fintap-outbox-worker'].map(name=>({name,pm2_env:{status:'online',pm_cwd:cwd}}))));}
}
if(cmd==='mv'){const values=args.filter(a=>!a.startsWith('-'));fs.renameSync(values[0],values[1]);}
if(cmd==='readlink')process.stdout.write(fs.realpathSync(args[args.length-1])+'\\n');
`;
  for(const name of ['git','npm','node','curl','pm2','flock','sleep','mv','readlink'])fs.writeFileSync(path.join(bin,name),stub,{mode:0o755});
  const replacements={
    '/var/www/billing-brilliance':app,
    '/var/lib/fintap/repository.git':path.join(directory,'repository'),
    '/var/lib/fintap/releases':path.join(directory,'releases'),
    '/etc/fintap/production.env':path.join(directory,'environment'),
    '/etc/fintap/sandbox.env':path.join(directory,'absent-sandbox-environment'),
    '/etc/fintap/migration.env':path.join(directory,'absent-migration-environment'),
    '/var/lib/fintap/deployed-revision':path.join(directory,'deployed-revision'),
    '/var/lock/fintap-deploy.lock':path.join(directory,'lock'),
    '/var/log/fintap-deploy.log':path.join(directory,'log'),
    '/usr/bin/':`${bin}/`,
  };
  let script=source;
  for(const [from,to] of Object.entries(replacements))script=script.split(from).join(to);
  // Node stubs must launch the real runtime rather than recursively using PATH.
  for(const name of fs.readdirSync(bin)){
    const file=path.join(bin,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('#!/usr/bin/env node',`#!${directory}/runtime`));
  }
  const result=spawnSync('bash',['-c',script],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,SSH_ORIGINAL_COMMAND:`deploy ${revision}`,DEPLOY_TEST_ROOT:directory,TEST_REVISION:revision,FAIL_STAGE:failure},timeout:20000});
  return {result,app,old};
};
test('rejects a deployment command without an exact tested revision',()=>{
  const result=spawnSync('bash',['-c',source],{encoding:'utf8',env:{...process.env,SSH_ORIGINAL_COMMAND:'deploy main; arbitrary-command'}});
  expect(result.status).toBe(2);
});
test.each(['build','migration'])('%s failure leaves the active release untouched',failure=>{
  const {result,app,old}=execute(failure);
  expect(result.status).not.toBe(0); expect(fs.realpathSync(app)).toBe(old);
  expect(fs.existsSync(path.join(directory,'deployed-revision'))).toBe(false);
});
test('success activates and records the exact requested revision',()=>{
  const {result,app,old}=execute();
  if(result.status!==0)throw new Error(result.stdout+result.stderr);
  expect(fs.realpathSync(app)).not.toBe(old);
  expect(fs.readFileSync(path.join(directory,'deployed-revision'),'utf8').trim()).toBe(revision);
});
test('readiness failure restores the previous release without rebuilding it',()=>{
  const {result,app,old}=execute('ready');
  if(result.status===0)throw new Error(result.stdout+result.stderr);
  expect(result.status).not.toBe(0); expect(fs.realpathSync(app)).toBe(old);
  expect(fs.readFileSync(path.join(directory,'process-cwd'),'utf8')).toBe(path.join(old,'server'));
  expect(fs.existsSync(path.join(directory,'migration-ran'))).toBe(true);
  expect(fs.existsSync(path.join(directory,'deployed-revision'))).toBe(false);
});
