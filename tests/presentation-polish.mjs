import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const reviews=read('public/assets/js/reviews.js');
const css=read('public/assets/css/site.css');
const insights=read('public/assets/js/grc-analyses.js');
const exercise=read('public/assets/js/td-exercise.js');
const admin=read('public/assets/js/admin.js');
const security=read('app/Core/Security.php');
const app=read('public/assets/js/app.js');
const router=read('public/router.php');
const auth=read('app/Services/AuthService.php');
assert.match(reviews,/const starRow = el\('div', \{ className: 'review-stars-row' \}/);
assert.match(reviews,/for \(let n = 1; n <= 5; n\+\+\)/);
assert.match(reviews,/type: 'radio'/);
assert.match(reviews,/required: n === 1/);
assert.match(reviews,/item\.n <= n/);
assert.match(reviews,/starOptions\.find\(item => item\.radio\.checked\)/);
assert.doesNotMatch(reviews,/el\('select', \{ id: 'product-review-rating'/);
for(const selector of ['.review-stars-picker','.review-star-option','.review-stars-row'])assert.ok(css.includes(selector));
assert.match(css,/input:focus-visible/);

assert.match(insights,/heading\('Analyses',/);
assert.match(insights,/Analyse des achats clients/);
assert.match(insights,/split\('-'\)\.reverse\(\)\.join\('\/'\)/);
assert.doesNotMatch(insights,/Exercice SPIRA \(TD\)|Analyses GRC/);
assert.doesNotMatch(exercise,/Exercice SPIRA|Source : exercice|barème du TD|Calculer le scoring du TD|Méthode de calcul|achat sur nombre de mois/);
assert.match(exercise,/Effectuer les calculs/);
assert.match(exercise,/Réinitialiser le tableau/);
assert.match(exercise,/Répartition des scores/);
assert.match(app,/\['admin-analyses', 'Analyses'/);

assert.match(admin,/api\('\/admin\/orders', automatic \? \{ passive: true \} : \{\}\)/);
assert.match(admin,/const timer = window\.setInterval/);
assert.match(admin,/!mutationPending && !loadingOrders && !needsRefresh/);
assert.match(admin,/JSON\.stringify\(items\) !== JSON\.stringify\(next\)/);
assert.match(security,/admin\/tickets\|admin\/orders\|admin\/dashboard/);
assert.match(admin,/selectProductOnMobile\(product\)/);
assert.match(admin,/Importer l’image/);

assert.doesNotMatch(router,/A Quick Tunnel publishes the storefront, never the administrative UI/);
assert.doesNotMatch(auth,/LOCAL_ADMIN_ONLY/);
assert.match(auth,/Security::login\(\(int\)\$user\['id'\]\)/);
assert.match(router,/Config::expectedOrigin\(\)/);
assert.match(security,/Security/);
console.log('OK — étoiles tactiles, noms professionnels, commandes auto et admin Cloudflare authentifié');
