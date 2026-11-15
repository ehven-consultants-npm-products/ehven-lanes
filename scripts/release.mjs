import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync, lstatSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repository='ehven-consultants-npm-products/ehven-lanes';
const sha=(bytes,algorithm='sha256',encoding='hex')=>createHash(algorithm).update(bytes).digest(encoding);
const run=(command,args,options={})=>execFileSync(command,args,{timeout:120000,maxBuffer:4*1024*1024,...options});
const json=(command,args)=>JSON.parse(String(run(command,args)));
const github=path=>json('gh',['api',path]);
const bounded=file=>{const stat=lstatSync(file);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('Expected bounded regular release file');return readFileSync(file);};
const metadata=()=>JSON.parse(readFileSync('package.json','utf8'));

export function prepare() {
 const pkg=metadata();
 if(pkg.name!=='@ehven/lanes'||!/^\d+\.\d+\.\d+$/.test(pkg.version)||pkg.repository.url!==`git+https://github.com/${repository}.git`)throw Error('Package release identity mismatch');
 mkdirSync('release',{recursive:true});
 const response=json('npm',['pack','--ignore-scripts','--offline','--json','--pack-destination','release']);
 const entries=Array.isArray(response)?response:Object.values(response);
 if(entries.length!==1||entries[0].name!==pkg.name||entries[0].version!==pkg.version)throw Error('Unexpected packed identity');
 const packed=entries[0];
 const expected=['CHANGELOG.md','LICENSE','README.md','SECURITY.md','dist/lanes.css','dist/lanes.min.css','docs/delivery.md','docs/installation.md','package.json'].sort();
 if(JSON.stringify(packed.files.map(x=>x.path).sort())!==JSON.stringify(expected))throw Error('Unexpected package file inventory');
 for(const name of ['lanes.css','lanes.min.css']) {
   const css=bounded(join('dist',name));
   const inside=run('tar',['-xOzf',join('release',packed.filename),'--','package/dist/'+name]);
   if(!css.equals(inside))throw Error('CSS artifact differs from packed output');
   copyFileSync(join('dist',name),join('release',name));
 }
 const tar=bounded(join('release',packed.filename));
 if('sha512-'+sha(tar,'sha512','base64')!==packed.integrity)throw Error('Packed integrity mismatch');
 const names=[packed.filename,'lanes.css','lanes.min.css'];
 writeFileSync('release/SHA256SUMS',names.map(name=>sha(bounded(join('release',name)))+'  '+name+'\n').join(''));
 const candidate={schemaVersion:1,repository,name:pkg.name,version:pkg.version,tag:'v'+pkg.version,tarball:packed.filename,integrity:packed.integrity,assets:[...names,'SHA256SUMS'].map(name=>({name,sha256:sha(bounded(join('release',name)))}))};
 writeFileSync('release/candidate.json',JSON.stringify(candidate,null,2)+'\n');
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`tag=${candidate.tag}\ntarball=${candidate.tarball}\n`);
 return candidate;
}

function candidate() {
 const value=JSON.parse(bounded('release/candidate.json'));
 const pkg=metadata();
 if(value.repository!==repository||value.name!==pkg.name||value.version!==pkg.version||value.tag!=='v'+pkg.version||!/^ehven-lanes-\d+\.\d+\.\d+\.tgz$/.test(value.tarball)||!Array.isArray(value.assets)||value.assets.length!==4||new Set(value.assets.map(x=>x.name)).size!==4)throw Error('Candidate metadata mismatch');
 const names=[value.tarball,'lanes.css','lanes.min.css','SHA256SUMS'];
 for(const asset of value.assets)if(!names.includes(asset.name)||sha(bounded(join('release',asset.name)))!==asset.sha256)throw Error('Candidate asset changed');
 if('sha512-'+sha(bounded(join('release',value.tarball)),'sha512','base64')!==value.integrity)throw Error('Candidate tarball changed');
 return value;
}

function currentMain() {
 const head=String(run('git',['rev-parse','HEAD'])).trim();
 if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_SHA!==head||github(`repos/${repository}/git/ref/heads/main`).object.sha!==head)throw Error('Release requires the exact current product main');
 const runs=github(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${head}&branch=main&per_page=10`).workflow_runs;
 const ci=runs.filter(x=>x.name==='CI'&&x.head_sha===head&&x.head_branch==='main'&&x.event==='push').sort((a,b)=>b.id-a.id)[0];
 if(!ci||ci.status!=='completed'||ci.conclusion!=='success')throw Error('Current main CI must pass before release');
 return head;
}

export function draft() {
 const value=candidate(),head=currentMain();
 const title='Lanes '+value.version,notes='CSS-only responsive lanes. See the versioned README and changelog for usage, compatibility and changes.';
 let ref;
 try {ref=github(`repos/${repository}/git/ref/tags/${value.tag}`).object;}
 catch(e){if(!/HTTP 404/i.test(String(e.stderr??'')))throw e;}
 if(ref&&(ref.type!=='commit'||ref.sha!==head))throw Error('Release tag differs from the verified source');
 if(!ref){run('gh',['api','--method','POST',`repos/${repository}/git/refs`,'-f','ref=refs/tags/'+value.tag,'-f','sha='+head]);ref=github(`repos/${repository}/git/ref/tags/${value.tag}`).object;}
 if(ref.type!=='commit'||ref.sha!==head)throw Error('Release tag readback differs');
 let release;
 try {release=json('gh',['release','view',value.tag,'--repo',repository,'--json','databaseId,isDraft,isImmutable,tagName,name,body,assets']);}
 catch(e) {if(!/release not found|HTTP 404/i.test(String(e.stderr??'')))throw e;}
 if(release) {
   if(!release.isDraft||release.tagName!==value.tag||release.name!==title||release.body!==notes)throw Error('Existing release conflicts with this draft');
 } else {
   run('gh',['release','create',value.tag,'--repo',repository,'--verify-tag','--draft','--title',title,'--notes',notes]);
   release=json('gh',['release','view',value.tag,'--repo',repository,'--json','databaseId,isDraft,tagName,name,body,assets']);
   if(!release.isDraft)throw Error('Expected unpublished draft');
 }
 ref=github(`repos/${repository}/git/ref/tags/${value.tag}`).object;
 if(ref.type!=='commit'||ref.sha!==head)throw Error('Release tag differs from the verified source');
 const temporary=mkdtempSync(join(tmpdir(),'lanes-assets-'));
 try {
   const expected=new Map(value.assets.map(x=>[x.name,x.sha256]));
   const observed=new Set();
   for(const asset of release.assets) {
     if(!expected.has(asset.name)||observed.has(asset.name))throw Error('Unexpected draft asset');
     const file=join(temporary,asset.name);run('gh',['release','download',value.tag,'--repo',repository,'--pattern',asset.name,'--output',file]);
     if(sha(bounded(file))!==expected.get(asset.name))throw Error('Draft asset conflicts');observed.add(asset.name);
   }
   for(const asset of value.assets)if(!observed.has(asset.name))run('gh',['release','upload',value.tag,'--repo',repository,join('release',asset.name)]);
   const final=json('gh',['release','view',value.tag,'--repo',repository,'--json','databaseId,isDraft,assets']);
   if(final.databaseId!==release.databaseId||!final.isDraft||final.assets.length!==4)throw Error('Draft changed while preparing');
   for(const asset of value.assets) {
     const file=join(temporary,'verified-'+asset.name);run('gh',['release','download',value.tag,'--repo',repository,'--pattern',asset.name,'--output',file]);
     if(sha(bounded(file))!==asset.sha256)throw Error('Draft readback differs');
   }
 } finally {rmSync(temporary,{recursive:true,force:true});}
 return {draft:true,tag:value.tag,source:head,assetsVerified:4};
}

export function stage() {
 const value=candidate();currentMain();
 if(String(run('npm',['--version'])).trim()!=='12.2.2')throw Error('npm 12.2.2 required');
 const temporary=mkdtempSync(join(tmpdir(),'lanes-stage-'));
 try {
   const env={};
   for(const key of ['PATH','HOME','TMPDIR','LANG','LC_ALL','SSL_CERT_FILE','SSL_CERT_DIR','NODE_EXTRA_CA_CERTS','ACTIONS_ID_TOKEN_REQUEST_URL','ACTIONS_ID_TOKEN_REQUEST_TOKEN','GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_REF','GITHUB_REF_NAME','GITHUB_REF_TYPE','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_WORKFLOW_REF','GITHUB_WORKFLOW_SHA','GITHUB_SERVER_URL','GITHUB_ACTOR','CI'])if(process.env[key]!==undefined)env[key]=process.env[key];
   for(const key of ['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy'])if(process.env[key]){if(!['http:','https:'].includes(new URL(process.env[key]).protocol))throw Error('Unsupported proxy');env[key]=process.env[key];}
   Object.assign(env,{NPM_CONFIG_USERCONFIG:join(temporary,'user.npmrc'),NPM_CONFIG_GLOBALCONFIG:join(temporary,'global.npmrc'),NPM_CONFIG_CACHE:join(temporary,'cache'),NPM_CONFIG_REGISTRY:'https://registry.npmjs.org/',NPM_CONFIG_STRICT_SSL:'true',NPM_CONFIG_FETCH_RETRIES:'0',NPM_CONFIG_FETCH_TIMEOUT:'30000',NPM_CONFIG_UPDATE_NOTIFIER:'false',NPM_CONFIG_LOGS_MAX:'0'});
   writeFileSync(env.NPM_CONFIG_USERCONFIG,'',{mode:0o600,flag:'wx'});writeFileSync(env.NPM_CONFIG_GLOBALCONFIG,'',{mode:0o600,flag:'wx'});
   const file=join(temporary,value.tarball);writeFileSync(file,bounded(join('release',value.tarball)),{mode:0o400,flag:'wx'});
   const result=JSON.parse(String(run('npm',['stage','publish',file,'--access','public','--tag','latest','--ignore-scripts','--provenance','--json'],{cwd:temporary,env})))[value.name];
   if(result?.name!==value.name||result.version!==value.version||result.integrity!==value.integrity||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.stageId??''))throw Error('Ambiguous stage submission; inspect existing stages before retrying');
   return {name:value.name,version:value.version,stageId:result.stageId,integrity:value.integrity,published:false};
 } finally {rmSync(temporary,{recursive:true,force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {const operation=process.argv[2];if(process.argv.length!==3||!['prepare','draft','stage'].includes(operation))throw Error('Use prepare, draft or stage');console.log(JSON.stringify(({prepare,draft,stage})[operation](),null,2));}
 catch {console.error('Release preparation stopped. Verify candidate, current CI and provider state before retrying.');process.exitCode=1;}
}
