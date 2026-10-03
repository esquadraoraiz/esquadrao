// Carrega src/index.html (com o motor) numa página falsa mínima, para testar o que é da tela:
// consultas ao ranking, marcação de treino, textos. A regra do jogo se testa direto no motor (simular.js).
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');

function elemento() {
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if (k === 'style') return { setProperty(){} };
      if (k === 'dataset') return (t.dataset = {});
      // app.querySelectorAll('.craque.pick') etc.: devolve um objeto por data-id/data-c/... encontrado no innerHTML,
      // guardado em t.__q para o teste "clicar" (chamar o onclick que a tela registrou)
      if (k === 'querySelectorAll') return sel => {
        const html = typeof t.innerHTML === 'string' ? t.innerHTML : '';
        const m = String(sel).match(/^\[data-(\w+)\]$/) || (String(sel) === '.craque.pick' ? [0, 'id'] : null);
        if (!m) return [];
        const re = String(sel) === '.craque.pick' ? /class="craque[^"]*pick[^"]*"[^>]*data-id="([^"]+)"/g : new RegExp('data-' + m[1] + '="([^"]+)"', 'g');
        const arr = [...html.matchAll(re)].map(v => { const e = elemento(); e.dataset = { [m[1]]: v[1] }; return e; });
        (t.__q = t.__q || {})[String(sel)] = arr; return arr;
      };
      if (k === 'querySelector' || k === 'closest') return () => elemento();
      if (k === 'getBoundingClientRect') return () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
      if (k === 'offsetWidth' || k === 'offsetHeight') return 0;
      if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
      if (typeof k === 'string' && /^(add|remove|append|set|scroll|focus|blur|click|dispatch|replace|insert|animate)/.test(k)) return () => ({ finished: Promise.resolve() });
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

// opcoes: { hash, armazenamento (objeto do localStorage), fetch }
function abrirPagina(opcoes = {}) {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const motor = fs.readFileSync(path.join(SRC, 'motor.js'), 'utf8');
  const elementos = {}, store = opcoes.armazenamento || {}, fila = [], pedidos = [];
  const document = {
    getElementById: id => (elementos[id] = elementos[id] || elemento()),
    querySelector: () => elemento(), querySelectorAll: () => [], createElement: () => elemento(),
    addEventListener(){}, documentElement: elemento(), body: elemento(), head: elemento(), cookie: '',
  };
  const ctx = {
    document, console, Math, Date, JSON, Intl, Promise, Map, Set, Array, Object, String, Number, RegExp, Error,
    setTimeout: fn => { fila.push(fn); return fila.length; }, clearTimeout(){},
    requestAnimationFrame: fn => { fila.push(() => fn(1e9)); return 1; }, performance: { now: () => 1e9 },
    matchMedia: () => ({ matches: true, addEventListener(){} }),
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { hash: opcoes.hash || '', search: '', protocol: 'https:', hostname: 'teste.local', origin: 'https://teste.local', pathname: '/' },
    history: { replaceState(){} }, navigator: {}, addEventListener(){}, innerWidth: 400, innerHeight: 800, scrollTo(){},
    fetch: (url, init) => { pedidos.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
      return opcoes.fetch ? opcoes.fetch(url, init) : Promise.reject(new Error('sem rede')); },
    getSelection: () => ({ removeAllRanges(){}, addRange(){} }), AudioContext: undefined,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(motor, ctx);
  try { vm.runInContext(js, ctx); } catch (e) { /* a página falsa não tem todo o DOM */ }
  const run = c => vm.runInContext(c, ctx);
  run('FAST_REVEAL=true');
  const drenar = async () => { for (let n = 0; n < 5000 && fila.length; n++) { fila.shift()(); await null; } };
  // "toca" num craque do draft (o primeiro, ou o de índice i)
  const contratarNoDraft = (i = 0) => run(`(app.__q && app.__q['.craque.pick'] || [])[${i}].onclick()`);
  return { run, drenar, pedidos, store, contratarNoDraft, ctx };
}

module.exports = { abrirPagina };
