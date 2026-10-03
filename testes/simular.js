// Joga uma campanha inteira só com o motor (sem tela), na mesma ordem em que a tela chama as regras.
// É o mesmo caminho que a validação do ranking no servidor (B09) vai usar.
const Motor = require('../src/motor.js');
const { CARDS, CRAQUES } = Motor;

// politica(mao, G, M) devolve as cartas do lance (até 3). canto(k) devolve o canto de cada cobrança de pênalti.
function campanha(seed, politica, opcoes = {}) {
  const canto = opcoes.canto || (() => 1);
  const G = Motor.novaCampanha(seed);
  if (opcoes.preparar) opcoes.preparar(G);
  const log = [];
  for (let jogo = 0; jogo < (opcoes.jogos || 4); jogo++) {
    const M = Motor.novaPartida(G);
    while (M.block < 6) {
      Motor.jogarLance(G, M, politica(M.hand, G, M).slice(0, 3));
      log.push(JSON.stringify({ j: G.stage, l: M.block, my: M.my, op: M.op, rolls: M.rolls }));
      if (M.block < 6) { Motor.fill(M); Motor.rollIntent(G, M); }
    }
    let pens = false, win = M.my > M.op;
    if (M.my === M.op) {
      pens = true; const P = Motor.novaDisputa();
      for (let k = 0; k < 40; k++) { const r = Motor.cobranca(G, M, P, canto(k)); if (r.decidido) { win = r.decidido === 'me'; break; } }
    }
    Motor.registrarResultado(G, M, win, pens);
    log.push('RESULT ' + JSON.stringify(G.results.at(-1)));
    if (!win || G.stage >= 3) break;
    G.stage++;
  }
  return { G, log };
}

// Políticas determinísticas para os testes
const POLITICAS = {
  risco: h => { const r = h.filter(c => CARDS[c.t].risk); const o = h.filter(c => !CARDS[c.t].risk); return [...r, ...o]; },
  defesa: h => { const d = h.filter(c => CARDS[c.t].def !== undefined); const a = h.filter(c => CARDS[c.t].atk !== undefined); return [...d.slice(0, 1), ...a]; },
  ultimas: h => h.slice(-3),
};

// Elenco usado no teste de campanha: Ronaldo (risco sorteia 2 vezes) e as quatro cartas de risco extras
function elencoDeRisco(G) {
  G.craques.push(CRAQUES.find(c => c.id === 'ronaldo'));
  G.deck.push(Motor.mk(G, 'bicicleta'), Motor.mk(G, 'voleio'), Motor.mk(G, 'cavadinha'), Motor.mk(G, 'saida'));
}

module.exports = { Motor, campanha, POLITICAS, elencoDeRisco };
