import assert from 'node:assert/strict';
import {cpSync,copyFileSync,existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const original=fileURLToPath(new URL('..',import.meta.url));
const folder=mkdtempSync(join(tmpdir(),'grc-fresh-install-'));
const project=join(folder,'project');
mkdirSync(project);
for (const directory of ['app','database','public']) cpSync(join(original,directory),join(project,directory),{recursive:true});
copyFileSync(join(original,'router.php'),join(project,'router.php'));
const port = await new Promise((resolve,reject)=>{
  const socket=net.createServer();
  socket.once('error',reject);
  socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});
});
const localHost='127.0.0.1:'+port;
const publicHost='grc-boutique-2026.trycloudflare.com';
const base={hostname:'127.0.0.1',port};
const env={...process.env,GRC_ORIGIN:'http://'+localHost};
delete env.GRC_DB_PATH;
let child=null;
async function req(path,{host=localHost,method='GET',body,cookie,csrf,origin}={}){
  return new Promise((resolve,reject)=>{
    const encoded=body===undefined?null:JSON.stringify(body);
    const headers={Host:host,Accept:'application/json'};
    if(encoded!==null){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(encoded);}
    if(cookie)headers.Cookie=cookie;
    if(csrf)headers['X-CSRF-Token']=csrf;
    if(origin)headers.Origin=origin;
    if(host===publicHost)headers['X-Forwarded-Proto']='https';
    const outgoing=http.request({...base,path,method,headers},incoming=>{
      let raw='';incoming.setEncoding('utf8');
      incoming.on('data',chunk=>raw+=chunk);
      incoming.on('end',()=>{
        let json=null;try{json=JSON.parse(raw);}catch{}
        resolve({status:incoming.statusCode,raw,json,headers:incoming.headers});
      });
    });
    outgoing.on('error',reject);outgoing.end(encoded??undefined);
  });
}
async function ready(){
  for(let i=0;i<70;i++){try{await req('/');return;}catch{}await delay(80);}
  throw Error('PHP ne démarre pas');
}
function session(){
  let cookie='',token='';
  return {
    async csrf(host=localHost){
      const r=await req('/api/v1/auth/csrf',{host,cookie});
      assert.equal(r.status,200,'CSRF local ou tunnel');
      const set=r.headers['set-cookie'];
      if(set?.length)cookie=set[0].split(';')[0];
      token=r.json?.data?.csrf_token;
      assert.ok(token);
      if(host===publicHost)assert.ok(set?.some(value=>/;\s*secure\b/i.test(value)),'Cookie Cloudflare doit rester HTTPS');
      return r;
    },
    async post(path,body,host=localHost) {
      const r=await req('/api/v1'+path,{host,method:'POST',body,cookie,csrf:token,origin:host===publicHost?'https://'+host:'http://'+host});
      const set=r.headers['set-cookie'];if(set?.length)cookie=set[0].split(';')[0];
      return r;
    },
    async get(path,host=localHost){return req('/api/v1'+path,{host,cookie});}
  };
}
try {
  const dbFile=join(project,'storage','grc.sqlite');
  const accFile=join(project,'storage','demo-accounts.json');
  assert.equal(existsSync(dbFile),false,'Le test doit commencer sans base');
  assert.equal(existsSync(accFile),false,'Le test doit commencer sans identifiants');

  child=spawn('php',['-S','127.0.0.1:'+port,'-t','public','public/router.php'],
    {cwd:project,env,stdio:'ignore'});
  await ready();
  assert.ok(existsSync(dbFile),'Le premier accès localhost doit initialiser la base');
  assert.ok(existsSync(accFile),'Le premier accès localhost doit créer les comptes privés');
  const accounts=JSON.parse(readFileSync(accFile,'utf8')).accounts;
  const admin=accounts.find(a=>a.role==='admin');
  assert.ok(admin);
  assert.match(admin.password,/^[A-Za-z]+-[A-Za-z]+-[A-Za-z]+-[0-9]{9}$/,'Mot de passe mémorisable, pas hexadécimal');
  assert.equal((await req('/api/v1/products')).status,200,'Catalogue local immédiat');
  assert.equal((await req('/api/v1/auth/me')).status,401,'Absence de session normale');
  assert.equal((await req('/admin.html')).status,200,'Administration locale accessible');
  const before=readFileSync(dbFile);

  assert.equal((await req('/')).status,200,'Page publique Cloudflare');
  assert.equal((await req('/assets/js/app.js',{host:publicHost})).status,200,'Script public tunnel');
  const products=await req('/api/v1/products',{host:publicHost});
  assert.equal(products.status,200,'Catalogue Cloudflare malgré GRC_ORIGIN local');
  assert.equal(products.json?.data?.items?.length,12);
  assert.equal((await req('/admin.html',{host:publicHost})).status,404,'Page admin interdite sur tunnel');
  assert.equal((await req('/api/v1/admin/dashboard',{host:publicHost})).status,404,'API admin interdite sur tunnel');
  assert.equal((await req('/',{host:'grc.trycloudflare.com.attacker.test'})).status,400,'Faux domaine rejeté');

  const visitor=session();await visitor.csrf(publicHost);
  const register=await visitor.post('/auth/register',{
    name:'Nouveau Client Tunnel',email:'nouveau.tunnel@example.test',password:'BonMotDePasse2026!'
  },publicHost);
  assert.equal(register.status,201,'Inscription client via Cloudflare : '+register.raw.slice(0,140));
  const login=await visitor.post('/auth/login',{
    email:'nouveau.tunnel@example.test',password:'BonMotDePasse2026!'
  },publicHost);
  assert.equal(login.status,200,'Connexion client via Cloudflare');
  assert.equal(login.json.data.user.role,'client');
  assert.equal((await visitor.get('/auth/me',publicHost)).status,200);

  const admCloud=session();await admCloud.csrf(publicHost);
  const denied=await admCloud.post('/auth/login',{email:admin.email,password:admin.password},publicHost);
  assert.equal(denied.status,403,'Administration interdite via tunnel');

  const admLocal=session();await admLocal.csrf();
  const allowed=await admLocal.post('/auth/login',{email:'admin',password:admin.password});
  assert.equal(allowed.status,200,'Connexion administrateur locale avec alias admin');
  assert.equal((await admLocal.get('/admin/dashboard')).status,200);
  const after=readFileSync(dbFile);
  assert.ok(after.length>=before.length,'La base d’installation n’a pas disparu');
  const saved=JSON.parse(readFileSync(accFile,'utf8')).accounts;
  assert.equal(saved.find(x=>x.role==='admin').password,admin.password,'Aucun reset en HTTP');

  // Alternate command: root router.php is only a relay to public/router.php.
  child.kill();
  await delay(250);
  child=spawn('php',['-S','127.0.0.1:'+port,'router.php'],
    {cwd:project,env:{...process.env},stdio:'ignore'});
  await ready();
  assert.equal((await req('/api/v1/products')).status,200,'Commande courte php -S ... router.php');
  assert.equal((await req('/database/schema.sql')).status,404,'Pas d’accès aux fichiers hors public');
  console.log('OK — clonage vierge, auto-installation sûre, boutique/Cloudflare, admin local et deux commandes PHP');
} finally {
  if(child){child.kill();await delay(180);}
  rmSync(folder,{recursive:true,force:true});
}
