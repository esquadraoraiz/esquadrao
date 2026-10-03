// Teste de campanha inteira: mesma semente + mesmas escolhas => mesma campanha, lance a lance.
// Joga só com o motor (src/motor.js), sem a página: é o caminho que a validação do ranking (B09) vai usar.
const { campanha, POLITICAS, elencoDeRisco } = require('./simular.js');

let ok = true;
const jogar = seed => campanha(seed, POLITICAS.risco, { preparar: elencoDeRisco }).log;

for (const seed of ['teste1', 'abc234', 'zz99xx', 'd20261002']) {
  const a = jogar(seed), b = jogar(seed);
  const iguais = JSON.stringify(a) === JSON.stringify(b);
  const riscos = a.filter(x => x.includes('"rolls":{"')).length;
  const jogos = a.filter(x => x.startsWith('RESULT')).map(x => JSON.parse(x.slice(7)));
  console.log(`${iguais ? 'OK   ' : 'FALHA'} semente ${seed}: ${jogos.length} jogos, ${riscos} lances com carta de risco, campanhas idênticas: ${iguais}`);
  console.log('      ' + jogos.map(r => `${r.t} ${r.score}`).join(' | '));
  ok = ok && iguais && a.length > 0;
}

// Pênaltis: o canto escolhido muda o resultado da cobrança, mas a mesma escolha repete o mesmo resultado.
let comPenaltis = 0, penIguais = true;
for (let i = 0; i < 300 && comPenaltis < 20; i++) {
  const seed = 'pen' + i;
  const opc = { preparar: elencoDeRisco, canto: k => k % 3 };
  const a = campanha(seed, POLITICAS.defesa, opc).G.results, b = campanha(seed, POLITICAS.defesa, opc).G.results;
  if (a.some(r => r.score.includes('pên'))) { comPenaltis++; penIguais = penIguais && JSON.stringify(a) === JSON.stringify(b); }
}
console.log(`${comPenaltis && penIguais ? 'OK   ' : 'FALHA'} campanhas com pênaltis se repetem iguais (${comPenaltis} campanhas com disputa)`);
ok = ok && comPenaltis > 0 && penIguais;

const c = jogar('teste1'), d = jogar('teste2');
const dif = JSON.stringify(c) !== JSON.stringify(d);
console.log(`${dif ? 'OK   ' : 'FALHA'} sementes diferentes geram campanhas diferentes`);
ok = ok && dif;
console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS'); process.exit(ok ? 0 : 1);
