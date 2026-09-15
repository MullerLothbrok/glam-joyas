'use strict';
const crypto = require('node:crypto');
const ORIGIN = 'https://glamjoyas.store';
const REPO = 'MullerLothbrok/glam-joyas';
const OWNER_ID = 323139182;
const SESSION = '__Host-glam_session', FLOW = '__Host-glam_flow';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function configuration(env = process.env) {
  if (!env.GLAM_GITHUB_CLIENT_ID || !env.GLAM_GITHUB_CLIENT_SECRET) {
    throw new HttpError(503, 'El panel todavía no está conectado. La tienda sigue funcionando.');
  }
  if (env.GLAM_SESSION_KEY && !/^[a-f0-9]{64}$/i.test(env.GLAM_SESSION_KEY)) throw new HttpError(503,'La configuración de sesión necesita revisión.');
  // GitHub generates a high-entropy client secret. HKDF derives a separate-purpose
  // cookie encryption key, avoiding a second manually provisioned credential.
  const key = env.GLAM_SESSION_KEY ? Buffer.from(env.GLAM_SESSION_KEY,'hex') : Buffer.from(crypto.hkdfSync('sha256',Buffer.from(env.GLAM_GITHUB_CLIENT_SECRET),Buffer.from(env.GLAM_GITHUB_CLIENT_ID),Buffer.from('glam-admin-cookie-encryption-v1'),32));
  return {clientId:env.GLAM_GITHUB_CLIENT_ID, clientSecret:env.GLAM_GITHUB_CLIENT_SECRET, key};
}
function seal(value, key, purpose) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(purpose));
  return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString('base64url');
}
function unseal(value, key, purpose, now = Date.now()) {
  try {
    if (typeof value !== 'string' || value.length > 3800) throw 0;
    const data = Buffer.from(value, 'base64url'), decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0,12));
    decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(data.subarray(-16));
    const result = JSON.parse(Buffer.concat([decipher.update(data.subarray(12,-16)), decipher.final()]));
    if (!Number.isSafeInteger(result.exp) || result.exp <= now) throw 0;
    return result;
  } catch { throw new HttpError(401, 'Volvé a ingresar con GitHub. Tu borrador permanece en este navegador.'); }
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v=>v.trim().split(/=(.*)/s).slice(0,2)).filter(v=>v.length===2));
}
function cookie(name, value, age) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
function equal(a,b) { return typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b)); }
function csrf(req, session) {
  if (req.headers.origin !== ORIGIN || !equal(req.headers['x-glam-csrf'], session.csrf)) throw new HttpError(403, 'La solicitud no es válida. Recargá el panel.');
}
async function github(token, path, method = 'GET', body, fetcher = fetch) {
  const response = await fetcher('https://api.github.com'+path, {
    method, redirect:'error', signal:AbortSignal.timeout(20000),
    headers:{Authorization:'Bearer '+token, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2026-03-10', 'User-Agent':'Glam-Catalog-Admin', ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if (!response.ok) {
    const status = response.status;
    throw new HttpError(status===401?401:status===409||status===422?409:status===403?403:502,
      status===401?'Volvé a ingresar con GitHub.':status===409||status===422?'El catálogo cambió en GitHub. Recargá y revisá tu borrador antes de publicar.':status===403?'GitHub no permitió la operación. Revisá los permisos de la aplicación o intentá más tarde.':'No pudimos completar la operación con GitHub. Tu borrador está guardado.');
  }
  return response.status===204?null:response.json();
}
async function authenticate(req, config, gh = github) {
  const session = unseal(cookies(req)[SESSION],config.key,'session');
  if (session.uid!==OWNER_ID || typeof session.token!=='string') throw new HttpError(403,'Esta cuenta no tiene acceso al panel.');
  // Revalidate with GitHub on every operation, so a revoked token stops working immediately.
  const user = await gh(session.token,'/user');
  if (user.id!==OWNER_ID) throw new HttpError(403,'Esta cuenta no tiene acceso al panel.');
  return session;
}
module.exports = {ORIGIN,REPO,OWNER_ID,SESSION,FLOW,HttpError,configuration,seal,unseal,cookies,cookie,equal,csrf,github,authenticate};
