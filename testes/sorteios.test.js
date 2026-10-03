// Teste do B05: mesma semente + mesma jogada = mesmo sorteio; jogada diferente = sorteio possivelmente diferente.
// Carrega o motor direto (src/motor.js), sem a página.
const Motor = require('../src/motor.js');

let uid = 0;
// Monta uma campanha e uma partida mínimas, numa fase e lance escolhidos
function preparar(seed, block) {
  const G = { seed, craques: [], stage: 1, results: [] };
  const M = { t: Motor.TEAMS[2][0], cond: null, zaga: 13, my: 0, op: 0, block, subs: 3, hist: [], hand: [] };
  return { G, M };
}
function sortearRisco(seed, block, tipos) {
  const { G, M } = preparar(seed, block);
  const cards = tipos.map(t => ({ id: ++uid, t }));
  const rr = Motor.riskRngs(G, M, cards);
  return cards.map((c, k) => Motor.CARDS[c.t].risk ? [c.t, Motor.rollRisk(G, c, rr[k])] : null).filter(Boolean).sort((a, b) => a[0] < b[0] ? -1 : 1);
}
function sortearPenalti(seed, hist, me, op, turn) {
  const { G, M } = preparar(seed, 5); M.hist = hist;
  const P = { me, op, turn, done: false };
  const kr = Motor.rng(G.seed, 'pen' + G.stage + '|' + Motor.penSig(M, P)); return [kr(), kr()];
}

let ok = true;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (nome, cond) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome); ok = ok && cond; };

const a1 = sortearRisco('abc123', 2, ['bicicleta', 'chutefora', 'toque']);
const a2 = sortearRisco('abc123', 2, ['toque', 'chutefora', 'bicicleta']);
check('risco: mesma semente, mesma jogada (ordem diferente) -> mesmo resultado ' + JSON.stringify(a1), igual(a1, a2));

// Jogadas ou lances diferentes devem, na maioria das sementes, dar resultados diferentes.
let difJogada = 0, difLance = 0, difSemente = 0;
for (let i = 0; i < 200; i++) {
  const s = 'sd' + i;
  const base = sortearRisco(s, 1, ['chutefora', 'toque']);
  if (!igual(base, sortearRisco(s, 1, ['chutefora', 'tabela']))) difJogada++;
  if (!igual(base, sortearRisco(s, 2, ['chutefora', 'toque']))) difLance++;
  if (!igual(base, sortearRisco('x' + s, 1, ['chutefora', 'toque']))) difSemente++;
}
check(`risco: mudar a jogada muda o sorteio (${difJogada}/200)`, difJogada > 150);
check(`risco: mudar o lance muda o sorteio (${difLance}/200)`, difLance > 150);
check(`risco: mudar a semente muda o sorteio (${difSemente}/200)`, difSemente > 150);

// Distribuição do Chute de fora (1 a 11) continua uniforme e dentro da faixa.
const cont = {};
for (let i = 0; i < 5000; i++) { const v = sortearRisco('u' + i, i % 6, ['chutefora'])[0][1]; cont[v] = (cont[v] || 0) + 1; }
const vals = Object.keys(cont).map(Number);
check('risco: Chute de fora só tira de 1 a 11 ' + JSON.stringify(cont), Math.min(...vals) === 1 && Math.max(...vals) === 11 && vals.length === 11);
check('risco: distribuição sem viés grosseiro (cada valor entre 6% e 12%)', Object.values(cont).every(n => n > 300 && n < 600));

const h = [{g:true,c:false},{g:false,c:false},{g:false,c:true},{g:false,c:false},{g:true,c:false},{g:false,c:true}];
const p1 = sortearPenalti('abc123', h, [true], [], 'me');
const p2 = sortearPenalti('abc123', h, [true], [], 'me');
check('pênalti: mesmo jogo e mesma disputa -> mesmo sorteio', igual(p1, p2));
const h2 = h.slice(); h2[1] = {g:true,c:false};
const p3 = sortearPenalti('abc123', h2, [true], [], 'me');
check('pênalti: jogo diferente (outro lance) -> sorteio diferente', !igual(p1, p3));
const p4 = sortearPenalti('abc123', h, [false], [], 'me');
check('pênalti: disputa diferente -> sorteio diferente', !igual(p1, p4));

// O motor não pode depender de Math.random: com Math.random quebrado, os sorteios continuam iguais.
const original = Math.random; Math.random = () => { throw new Error('Math.random no motor'); };
try { check('motor: sorteio de risco não usa Math.random', igual(sortearRisco('abc123', 2, ['bicicleta', 'chutefora', 'toque']), a1)); }
catch (e) { check('motor: sorteio de risco não usa Math.random (' + e.message + ')', false); }
finally { Math.random = original; }

console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
process.exit(ok ? 0 : 1);
