// Teste do B05: mesma semente + mesma jogada = mesmo sorteio; jogada diferente = sorteio possivelmente diferente.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../src/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function el() {
  const e = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if (k === 'style') return { setProperty(){} };
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector' || k === 'closest') return () => null;
      if (k === 'getBoundingClientRect') return () => ({ top:0,left:0,width:0,height:0,bottom:0,right:0 });
      if (typeof k === 'string' && /^(add|remove|append|set|scroll|focus|blur|click|dispatch|replace|insert)/.test(k)) return () => {};
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return e;
}
const elements = {};
const document = {
  getElementById: id => (elements[id] = elements[id] || el()),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: () => el(), addEventListener(){}, documentElement: el(), body: el(),
};
const store = {};
const ctx = {
  document, console, Math, Date, JSON, Intl, Promise, Map, Set, Array, Object, String, Number, RegExp, Error,
  setTimeout: () => 0, clearTimeout(){}, requestAnimationFrame: () => 0, performance: { now: () => 0 },
  matchMedia: () => ({ matches: true, addEventListener(){} }),
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  location: { hash: '', protocol: 'https:', hostname: 'teste.local', origin: 'https://teste.local', pathname: '/' },
  history: { replaceState(){} }, navigator: {}, addEventListener(){}, innerWidth: 400, innerHeight: 800,
  fetch: () => Promise.reject(new Error('sem rede no teste')), getSelection: () => ({ removeAllRanges(){}, addRange(){} }),
};
ctx.window = ctx;
vm.createContext(ctx);
try { vm.runInContext(js, ctx); } catch (e) { console.log('aviso na carga:', e.message); }
const run = code => vm.runInContext(code, ctx);

// Monta um jogo com semente fixa, numa fase e lance escolhidos, e joga um conjunto de cartas de risco.
run(`
function preparar(seed, block){
  G={name:'Teste', cash:6, deck:START_DECK.map(mk), craques:[], stage:1, results:[], seed, challenge:true, daily:false};
  M={t:TEAMS[2][0], cond:null, zaga:13, my:0, op:0, block, subs:3, hist:[], hand:[], sel:new Set()};
}
function sortearRisco(seed, block, tipos){
  preparar(seed, block);
  const cards=tipos.map(t=>({id:++uid,t}));
  const rr=riskRngs(cards);
  return cards.map((c,k)=>CARDS[c.t].risk?[c.t, rollRisk(c, rr[k])]:null).filter(Boolean).sort((a,b)=>a[0]<b[0]?-1:1);
}
function sortearPenalti(seed, hist, me, op, turn){
  preparar(seed, 5); M.hist=hist; P={me, op, turn, done:false};
  const kr=rng('pen'+G.stage+'|'+penSig()); return [kr(), kr()];
}
`);

let ok = true;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (nome, cond) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome); ok = ok && cond; };

const a1 = run(`sortearRisco('abc123', 2, ['bicicleta','chutefora','toque'])`);
const a2 = run(`sortearRisco('abc123', 2, ['toque','chutefora','bicicleta'])`);
check('risco: mesma semente, mesma jogada (ordem diferente) -> mesmo resultado ' + JSON.stringify(a1), igual(a1, a2));

// Jogadas ou lances diferentes devem, na maioria das sementes, dar resultados diferentes.
let difJogada = 0, difLance = 0, difSemente = 0;
for (let i = 0; i < 200; i++) {
  const s = 'sd' + i;
  const base = run(`sortearRisco('${s}', 1, ['chutefora','toque'])`);
  if (!igual(base, run(`sortearRisco('${s}', 1, ['chutefora','tabela'])`))) difJogada++;
  if (!igual(base, run(`sortearRisco('${s}', 2, ['chutefora','toque'])`))) difLance++;
  if (!igual(base, run(`sortearRisco('x${s}', 1, ['chutefora','toque'])`))) difSemente++;
}
check(`risco: mudar a jogada muda o sorteio (${difJogada}/200)`, difJogada > 150);
check(`risco: mudar o lance muda o sorteio (${difLance}/200)`, difLance > 150);
check(`risco: mudar a semente muda o sorteio (${difSemente}/200)`, difSemente > 150);

// Distribuição do Chute de fora (1 a 11) continua uniforme e dentro da faixa.
const cont = {};
for (let i = 0; i < 5000; i++) { const v = run(`sortearRisco('u${i}', ${i % 6}, ['chutefora'])`)[0][1]; cont[v] = (cont[v] || 0) + 1; }
const vals = Object.keys(cont).map(Number);
check('risco: Chute de fora só tira de 1 a 11 ' + JSON.stringify(cont), Math.min(...vals) === 1 && Math.max(...vals) === 11 && vals.length === 11);
check('risco: distribuição sem viés grosseiro (cada valor entre 6% e 12%)', Object.values(cont).every(n => n > 300 && n < 600));

const h = [{g:true,c:false},{g:false,c:false},{g:false,c:true},{g:false,c:false},{g:true,c:false},{g:false,c:true}];
const p1 = run(`sortearPenalti('abc123', ${JSON.stringify(h)}, [true], [], 'me')`);
const p2 = run(`sortearPenalti('abc123', ${JSON.stringify(h)}, [true], [], 'me')`);
check('pênalti: mesmo jogo e mesma disputa -> mesmo sorteio', igual(p1, p2));
const h2 = h.slice(); h2[1] = {g:true,c:false};
const p3 = run(`sortearPenalti('abc123', ${JSON.stringify(h2)}, [true], [], 'me')`);
check('pênalti: jogo diferente (outro lance) -> sorteio diferente', !igual(p1, p3));
const p4 = run(`sortearPenalti('abc123', ${JSON.stringify(h)}, [false], [], 'me')`);
check('pênalti: disputa diferente -> sorteio diferente', !igual(p1, p4));

console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
process.exit(ok ? 0 : 1);
