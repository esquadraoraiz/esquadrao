// Teste de campanha inteira: mesma semente + mesmas escolhas => mesma campanha, lance a lance.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../src/index.html', 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

function el() {
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if (k === 'style') return { setProperty(){} };
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector' || k === 'closest') return () => el();
      if (k === 'getBoundingClientRect') return () => ({ top:0,left:0,width:0,height:0,bottom:0,right:0 });
      if (k === 'offsetWidth' || k === 'offsetHeight') return 0;
      if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
      if (typeof k === 'string' && /^(add|remove|append|set|scroll|focus|blur|click|dispatch|replace|insert|animate)/.test(k)) return () => ({ finished: Promise.resolve() });
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

async function campanha(seed, politica) {
  const elements = {}, store = {}, fila = [];
  const document = {
    getElementById: id => (elements[id] = elements[id] || el()),
    querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(),
    addEventListener(){}, documentElement: el(), body: el(),
  };
  const ctx = {
    document, console, Math, Date, JSON, Intl, Promise, Map, Set, Array, Object, String, Number, RegExp, Error,
    setTimeout: (fn) => { fila.push(fn); return fila.length; }, clearTimeout(){},
    requestAnimationFrame: (fn) => { fila.push(() => fn(1e9)); return 1; }, performance: { now: () => 1e9 },
    matchMedia: () => ({ matches: true, addEventListener(){} }),
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem(){} },
    location: { hash: '', protocol: 'https:', hostname: 'teste.local', origin: 'https://teste.local', pathname: '/' },
    history: { replaceState(){} }, navigator: {}, addEventListener(){}, innerWidth: 400, innerHeight: 800,
    fetch: () => Promise.reject(new Error('sem rede')), getSelection: () => ({ removeAllRanges(){}, addRange(){} }),
    AudioContext: undefined,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(js, ctx); } catch (e) { /* carga da tela inicial pode reclamar do DOM falso */ }
  const run = c => vm.runInContext(c, ctx);
  const drenar = async () => { for (let n = 0; n < 5000 && fila.length; n++) { const f = fila.shift(); try { f(); } catch(e) { throw e; } await null; } };

  run(`FAST_REVEAL=true; newRun(${JSON.stringify(seed)}); G.craques.push(CRAQUES.find(c=>c.id==='ronaldo')); G.deck.push(mk('bicicleta'),mk('voleio'),mk('cavadinha'),mk('saida'));`);
  const log = [];
  for (let jogo = 0; jogo < 4; jogo++) {
    run(`startMatch()`); await drenar();
    for (let lance = 0; lance < 6; lance++) {
      // política fixa: escolhe as cartas por regra determinística sobre a mão
      run(`M.sel.clear(); (${politica})(M.hand).forEach(c=>M.sel.add(c.id)); playBlock();`);
      await drenar();
      log.push(run(`JSON.stringify({j:G.stage, l:M.block, my:M.my, op:M.op, rolls:M.rolls})`));
      if (run(`M.over`)) break;
    }
    await drenar();
    // pênaltis, se houver: sempre o canto do meio
    for (let k = 0; k < 20 && run(`typeof P!=='undefined' && P && !P.done && M.my===M.op`); k++) { run(`kick(1)`); await drenar(); }
    await drenar();
    const r = run(`JSON.stringify(G.results.at(-1)||null)`); log.push('RESULT ' + r);
    if (!run(`G.results.at(-1) && G.results.at(-1).win`)) break;
    if (run(`G.stage>=4`)) break;
  }
  return log;
}

(async () => {
  const politica = `h=>{ const r=h.filter(c=>CARDS[c.t].risk); const o=h.filter(c=>!CARDS[c.t].risk); return [...r,...o].slice(0,3); }`;
  let ok = true;
  for (const seed of ['teste1', 'abc234', 'zz99xx', 'd20261002']) {
    const a = await campanha(seed, politica), b = await campanha(seed, politica);
    const iguais = JSON.stringify(a) === JSON.stringify(b);
    const riscos = a.filter(x => x.includes('"rolls":{"')).length;
    console.log(`${iguais ? 'OK   ' : 'FALHA'} semente ${seed}: ${a.filter(x=>x.startsWith('RESULT')).length} jogos, ${riscos} lances com carta de risco, campanhas idênticas: ${iguais}`);
    console.log('      ' + a.filter(x=>x.startsWith('RESULT')).map(x=>{ const r=JSON.parse(x.slice(7)); return r ? `${r.t} ${r.score}` : '-'; }).join(' | '));
    ok = ok && iguais && a.length > 0;
  }
  const c = await campanha('teste1', politica), d = await campanha('teste2', politica);
  const dif = JSON.stringify(c) !== JSON.stringify(d);
  console.log(`${dif ? 'OK   ' : 'FALHA'} sementes diferentes geram campanhas diferentes`);
  ok = ok && dif;
  console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERRO:', e.stack); process.exit(1); });
