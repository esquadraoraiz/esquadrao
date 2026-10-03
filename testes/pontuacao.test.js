// Teste da pontuação do ranking (B02):
//   pontos = 500 + 1.000 por vitória + espetáculo
//   espetáculo = 10 × saldo + 5 × gol + 20 × golaço + 50 × pintura, limitado a 0..999
// e da regra do Firestore, que recusa pontuação diferente. A regra é lida de firestore.rules e avaliada aqui.
const fs = require('fs');
const { Motor, campanha, POLITICAS, elencoDeRisco } = require('./simular.js');

let ok = true;
const check = (nome, cond) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome); ok = ok && cond; };

// ---------- Exemplos do GD (claude/entregas/B02-pontos.md) ----------
// Monta um jogo a partir do placar e das categorias dos gols seus; os lances restantes são sem gol.
function jogo(gf, ga, win, cats, opc = {}) {
  const hist = [];
  for (const c of cats) hist.push({ g: true, c: false, ataque: opc.ataque || 20, zaga: 10, cat: c });
  for (let i = 0; i < ga; i++) hist.push({ g: false, c: true, ataque: 0, zaga: 10, cat: null });
  while (hist.length < 6) hist.push({ g: false, c: false, ataque: 5, zaga: 10, cat: 'defendeu' });
  if (cats.length !== gf) throw new Error('categorias não batem com os gols');
  return { t: 'X', score: `${gf}x${ga}${opc.pens ? ' (pên)' : ''}`, win, gf, ga, hist, stage: 0 };
}
const G = (...results) => ({ results });
const pts = g => Motor.pontuacao(g);
const n = (k, c) => Array(k).fill(c);

const ex1 = pts(G(jogo(1, 0, true, ['gol']), jogo(2, 1, true, n(2, 'gol')), jogo(1, 1, true, ['gol'], { pens: true }), jogo(1, 0, true, ['gol'])));
check(`exemplo 1 · vitória apertada: 4.555 (deu ${ex1.score}, espetáculo ${ex1.espetaculo})`, ex1.score === 4555 && ex1.espetaculo === 55);

const ex2 = pts(G(jogo(4, 0, true, [...n(3, 'gol'), 'golaco']), jogo(3, 1, true, [...n(2, 'gol'), 'golaco']), jogo(3, 0, true, [...n(2, 'gol'), 'golaco']), jogo(2, 0, true, n(2, 'gol'))));
check(`exemplo 2 · goleada sem Pintura: 4.715 (deu ${ex2.score}, ${ex2.golaco} golaços)`, ex2.score === 4715 && ex2.golaco === 3 && ex2.pintura === 0);

const ex3 = pts(G(jogo(3, 1, true, ['gol', 'golaco', 'pintura']), jogo(2, 0, true, n(2, 'gol')), jogo(1, 2, false, ['pintura'])));
check(`exemplo 3 · derrota com Pintura: 2.665 (deu ${ex3.score})`, ex3.score === 2665 && ex3.pintura === 2 && ex3.stage === 2);

const lim = pts(G(jogo(0, 3, false, [])));
check(`caso-limite · 0x3 na estreia: 500, espetáculo não fica negativo (deu ${lim.score})`, lim.score === 500 && lim.espetaculo === 0);

// Grid de exemplo do B02: 4 vitórias, saldo +6, 5 Gols, 2 Golaços e 1 Pintura, maior lance 47
const gridJogos = () => [
  jogo(3, 0, true, ['gol', 'golaco', 'gol']),
  jogo(2, 1, true, ['gol', 'pintura'], { ataque: 47 }),
  jogo(1, 1, true, ['gol'], { pens: true }),
  jogo(2, 0, true, ['gol', 'golaco'])];
const gridEx = pts(G(...gridJogos()));
check(`grid de exemplo do B02: 4.675 e maior lance 47 (deu ${gridEx.score}, maior lance ${gridEx.maiorLance})`, gridEx.score === 4675 && gridEx.espetaculo === 175 && gridEx.maiorLance === 47);

const teto = pts(G(...Array(12).fill(0).map(() => jogo(6, 0, true, n(6, 'pintura')))));
check(`teto · 12 vitórias só de Pinturas: espetáculo para em 999 (pontos ${teto.score})`, teto.espetaculo === 999 && teto.score === 500 + 12000 + 999);

// Uma vitória a mais sempre vence: o pior com V vitórias contra o melhor com V-1
for (const V of [1, 4, 9]) {
  const pior = pts(G(...Array(V).fill(0).map(() => jogo(0, 0, true, [], { pens: true })), jogo(0, 6, false, [])));
  const melhor = pts(G(...Array(V - 1).fill(0).map(() => jogo(6, 0, true, n(6, 'pintura'))), jogo(0, 1, false, [])));
  check(`${V} vitória(s) sem gol vence ${V - 1} com espetáculo máximo (${pior.score} > ${melhor.score})`, pior.score > melhor.score);
}

// ---------- Categoria do lance no motor ----------
function lanceCom(total, zaga, opc = {}) {
  // monta uma partida e força o total do ataque com uma carta de valor conhecido
  const G = { seed: 'cat', craques: opc.renato ? [Motor.CRAQUES.find(c => c.id === 'renato')] : [], stage: 0, results: [], uid: 0 };
  const M = { t: Motor.TEAMS[1][0], cond: null, zaga, my: 0, op: 0, block: 0, subs: 3, extra: 0, press: 0, pressNext: 0, barrigaUsed: false,
              hist: [], deckR: () => 0, draw: [], disc: [], hand: [], debuff: 0, intent: 0, over: false };
  const carta = { id: 1, t: 'toque' };
  M.hand = [carta];
  const CARDS = Motor.CARDS, antigo = CARDS.toque.atk;
  CARDS.toque.atk = total - (opc.renato ? 1 : 0); // Renato dá +1 por jogada
  try { return Motor.jogarLance(G, M, [carta]); } finally { CARDS.toque.atk = antigo; }
}
const casos = [[9, 10, 'defendeu'], [10, 10, 'gol'], [19, 10, 'gol'], [20, 10, 'golaco'], [29, 10, 'golaco'], [30, 10, 'pintura'], [99, 10, 'pintura']];
for (const [t, z, cat] of casos) { const L = lanceCom(t, z); check(`lance ${t} contra zaga ${z}: ${cat} (deu ${L.cat}; zaga depois ${L.zagaDepois})`, L.cat === cat && L.h.ataque === t && L.h.zaga === z); }
const barriga = lanceCom(7, 10, { renato: true });
check(`gol de barriga do Renato é sempre Gol (${barriga.cat}, gol: ${barriga.gol})`, barriga.gol && barriga.cat === 'gol');

// ---------- Regra do Firestore, lida do arquivo e avaliada aqui ----------
const regras = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
const corpo = regras.slice(regras.indexOf('allow create: if') + 'allow create: if'.length, regras.indexOf(';', regras.indexOf('allow create: if')));
let js = corpo
  .replace(/\/\/[^\n]*/g, '')
  .replace(/request\.resource\.data/g, 'd')
  .replace(/request\.time/g, 'T')
  .replace(/duration\.value\(1, 'd'\)/g, '86400000')
  .replace(/d\.keys\(\)\.hasOnly\(/g, 'hasOnly(d,').replace(/d\.keys\(\)\.hasAll\(/g, 'hasAll(d,')
  .replace(/(d(?:\.\w+)+(?:\[0\])?) is (int|string|list|bool|timestamp)/g, (m, x, t) => `is_${t}(${x})`)
  .replace(/\.size\(\)/g, '.length')
  .replace(/(d\.\w+)\.matches\(('[^']*')\)/g, 'new RegExp($2).test($1)');
const regra = new Function('d', 'T', `
  const hasOnly=(o,ks)=>Object.keys(o).every(k=>ks.includes(k)), hasAll=(o,ks)=>ks.every(k=>k in o);
  const is_int=Number.isInteger, is_string=x=>typeof x==='string', is_list=Array.isArray, is_bool=x=>typeof x==='boolean', is_timestamp=x=>typeof x==='number';
  return (${js});`);
const agora = 1790000000000;
// O documento que o jogo envia (mesmos campos de runScore/rankSubmit em src/index.html)
const doc = (g, extra = {}) => { const p = Motor.pontuacao(g);
  return { team: 'Teste', score: p.score, stage: p.stage, champion: p.champion, gf: p.gf, ga: p.ga, golaco: p.golaco, pintura: p.pintura,
           espetaculo: p.espetaculo, maiorLance: p.maiorLance, temporada: 1, craques: ['Zico'], seed: 'd20261002', createdAt: agora, ...extra }; };
const aceita = d => regra(d, agora);

check('regra aceita o exemplo do grid (4.675)', aceita(doc(G(...gridJogos()))));
check('regra aceita o caso-limite com espetáculo 0 (bruto negativo)', aceita(doc(G(jogo(0, 3, false, [])))));
check('regra aceita o teto de 999 (bruto acima de 999)', (() => { const d = doc(G(...Array(4).fill(0).map(() => jogo(6, 0, true, n(6, 'pintura'))))); return d.espetaculo === 999 && aceita({ ...d, stage: 4 }); })());
const base = doc(G(jogo(3, 1, true, ['gol', 'golaco', 'pintura']), jogo(2, 0, true, n(2, 'gol')), jogo(1, 2, false, ['pintura'])));
check('regra recusa pontos com 1 a mais', !aceita({ ...base, score: base.score + 1 }));
check('regra recusa espetáculo que não bate com os gols', !aceita({ ...base, espetaculo: base.espetaculo + 5, score: base.score + 5 }));
check('regra recusa espetáculo 0 quando o bruto é positivo', !aceita({ ...base, espetaculo: 0, score: base.score - base.espetaculo }));
check('regra recusa mais golaços e pinturas do que gols', !aceita({ ...base, golaco: base.gf }));
check('regra recusa sem o campo temporada', !aceita((({ temporada, ...r }) => r)(base)));
check('regra recusa temporada diferente de 1', !aceita({ ...base, temporada: 0 }));
check('regra recusa maior lance acima de 9.999', !aceita({ ...base, maiorLance: 10000 }));
const antigo = { team: 'Teste', score: 500 + 2000 + 30 + 6, stage: 2, champion: false, gf: 6, ga: 3, craques: ['Zico'], seed: 'abcd', createdAt: agora };
check('regra recusa o formato antigo (navegador com a versão em cache)', !aceita(antigo));

// Campanhas reais jogadas pelo motor: o documento que o jogo envia passa na regra
let total = 0, passam = 0, comCat = 0;
for (let i = 0; i < 200; i++) {
  const pol = [POLITICAS.risco, POLITICAS.defesa, POLITICAS.ultimas][i % 3];
  const { G: g } = campanha('pts' + i, pol, { preparar: elencoDeRisco, canto: k => (k + i) % 3 });
  const d = doc(g); total++; if (aceita(d)) passam++; if (d.golaco || d.pintura) comCat++;
}
check(`campanhas do motor: a regra do Firestore aceita o documento enviado (${passam}/${total}; ${comCat} com Golaço ou Pintura)`, passam === total && comCat > 0);

console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
process.exit(ok ? 0 : 1);
