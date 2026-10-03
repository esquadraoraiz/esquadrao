// Teste da pontuação do ranking: 500 + 1.000 por vitória + 10 por gol de saldo + 1 por gol.
// A mesma fórmula está em firestore.rules, que recusa pontuação diferente.
const fs = require('fs');
const { Motor, campanha, POLITICAS, elencoDeRisco } = require('./simular.js');

let ok = true;
const check = (nome, cond) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome); ok = ok && cond; };
const jogo = (gf, ga, win) => ({ t: 'X', score: `${gf}x${ga}`, win, gf, ga, hist: [], stage: 0 });
const pts = results => Motor.pontuacao({ results });

// Casos feitos à mão
check('sem jogos: 500', pts([]).score === 500);
check('perdeu a estreia por 0x2: 500 - 20 = 480', pts([jogo(0, 2, false)]).score === 480);
check('ganhou 2x1 e perdeu 1x3: 500 + 1.000 + 10×(3-4) + 3 = 1.493', pts([jogo(2, 1, true), jogo(1, 3, false)]).score === 1493);
check('venceu nos pênaltis (1x1): conta só a vitória e os gols do jogo, 500 + 1.000 + 0 + 1 = 1.501', pts([{ ...jogo(1, 1, true), score: '1x1 (pên)' }]).score === 1501);
const campeao = pts([jogo(3, 0, true), jogo(2, 1, true), jogo(1, 1, true), jogo(4, 2, true)]);
check('campeão (4 vitórias, 10 a 4): 500 + 4.000 + 60 + 10 = 4.570, champion e stage 4', campeao.score === 4570 && campeao.champion === true && campeao.stage === 4);
const vice = pts([jogo(1, 0, true), jogo(1, 0, true), jogo(1, 0, true), jogo(0, 1, false)]);
check('vice (3 vitórias): stage 3, champion falso', vice.stage === 3 && vice.champion === false && vice.score === 500 + 3000 + 20 + 3);
const semFim = pts([...Array(6)].map(() => jogo(2, 1, true)));
check('modo sem fim (6 vitórias): stage 6, champion', semFim.stage === 6 && semFim.champion && semFim.score === 500 + 6000 + 60 + 12);

// A fórmula do motor é a mesma das regras do Firestore (transcrita aqui da regra de create)
const regras = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8').replace(/\s+/g, ' ');
const formulaNasRegras = /score == 500 \+ request\.resource\.data\.stage \* 1000 \+ \(request\.resource\.data\.gf - request\.resource\.data\.ga\) \* 10 \+ request\.resource\.data\.gf/.test(regras);
check('firestore.rules tem a fórmula 500 + stage×1000 + (gf-ga)×10 + gf', formulaNasRegras);
const regraFirestore = e => 500 + e.stage * 1000 + (e.gf - e.ga) * 10 + e.gf;

// Campanhas reais jogadas pelo motor: a pontuação bate com a regra do Firestore e com as restrições dela
let n = 0, batem = 0, restricoes = 0;
for (let i = 0; i < 200; i++) {
  const pol = [POLITICAS.risco, POLITICAS.defesa, POLITICAS.ultimas][i % 3];
  const { G } = campanha('pts' + i, pol, { preparar: elencoDeRisco, canto: k => (k + i) % 3 });
  const p = Motor.pontuacao(G); n++;
  if (p.score === regraFirestore(p)) batem++;
  if (p.champion === (p.stage >= 4) && p.gf <= 6 * (p.stage + 1) && p.ga <= 6 * (p.stage + 1) && p.ga <= p.gf + 6) restricoes++;
}
check(`campanhas do motor: pontuação igual à regra do Firestore (${batem}/${n})`, batem === n);
check(`campanhas do motor: passam nas restrições de stage, gf e ga das regras (${restricoes}/${n})`, restricoes === n);

console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
process.exit(ok ? 0 : 1);
