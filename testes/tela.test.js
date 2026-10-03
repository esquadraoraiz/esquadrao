// Testes do que é da tela (src/index.html), numa página falsa (testes/pagina.js):
// - ranking só da temporada atual (D31);
// - duelo por link: só a primeira campanha de cada pessoa num código conta (D34), como no desafio do dia.
const { abrirPagina } = require('./pagina.js');

let ok = true;
const check = (nome, cond) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + nome); ok = ok && cond; };
const resposta = (status, corpo) => Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(corpo) });
const doc = (team, score, temporada) => ({ document: { fields: { team: { stringValue: team }, score: { integerValue: String(score) },
  stage: { integerValue: '1' }, gf: { integerValue: '2' }, ga: { integerValue: '1' }, ...(temporada ? { temporada: { integerValue: String(temporada) } } : {}) } } });
// procura o filtro de temporada == 1 em qualquer lugar da consulta
const temFiltroTemporada = q => JSON.stringify(q).includes('{"fieldFilter":{"field":{"fieldPath":"temporada"},"op":"EQUAL","value":{"integerValue":"1"}}}');

(async () => {
  // ---------- Ranking da temporada 1 ----------
  {
    const p = abrirPagina({ fetch: () => resposta(200, [doc('Real Pelada', 4600, 1), doc('Real Pelada', 3500, 1), doc('Atlético Várzea', 2600, 1)]) });
    const geral = await p.run('rankFetchRaw()');
    const q = p.pedidos.at(-1).body.structuredQuery;
    check('ranking geral: consulta filtra temporada == 1', temFiltroTemporada(q));
    check('ranking geral: ordenado por pontos', JSON.stringify(q.orderBy) === JSON.stringify([{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }]));
    check('ranking geral: melhor campanha de cada time, em ordem', geral.map(r => r.team + ' ' + r.score).join(', ') === 'Real Pelada 4600, Atlético Várzea 2600');

    await p.run(`challengeFetchRaw('d20261003')`);
    const qd = p.pedidos.at(-1).body.structuredQuery;
    check('ranking do dia e placar do duelo: filtram o código e a temporada == 1', temFiltroTemporada(qd) && JSON.stringify(qd).includes('"stringValue":"d20261003"'));
  }
  {
    // sem o índice composto, o Firestore recusa a consulta ordenada: a busca simples também precisa do filtro
    let n = 0;
    const p = abrirPagina({ fetch: () => (++n % 2 ? resposta(400, {}) : resposta(200, [doc('Unidos da Resenha', 1500, 1), doc('Sport Club Churrasco', 2510, 1)])) });
    const geral = await p.run('rankFetchRaw()');
    const [ordenada, simples] = p.pedidos.slice(-2).map(x => x.body.structuredQuery);
    check('sem índice: a consulta de reserva também filtra a temporada', temFiltroTemporada(ordenada) && temFiltroTemporada(simples) && !simples.orderBy);
    check('sem índice: a lista é ordenada no jogo', geral.map(r => r.score).join(',') === '2510,1500');
  }

  // ---------- Duelo por link: só a primeira campanha conta (D34) ----------
  const armazenamento = {};
  const jogarCodigo = async (codigo) => {
    const p = abrirPagina({ armazenamento, hash: codigo ? '#d-' + codigo : '' });
    const estado = JSON.parse(p.run('JSON.stringify({seed:G.seed, desafio:G.challenge, treino:G.practice})'));
    p.contratarNoDraft(0); await p.drenar();
    estado.seedEnviada = p.run('runScore().seed');
    estado.banner = p.run(`app.innerHTML.match(/Desafio recebido[^<]*/) ? app.innerHTML.match(/Desafio recebido[^<]*/)[0] : ''`);
    return estado;
  };
  const d1 = await jogarCodigo('k7m2qa');
  check(`duelo: a primeira campanha no código conta (treino: ${d1.treino}, envia a semente: ${d1.seedEnviada})`, d1.desafio && !d1.treino && d1.seedEnviada === 'k7m2qa');
  const d2 = await jogarCodigo('k7m2qa');
  check(`duelo: a segunda campanha no mesmo código vira treino e não entra no placar (semente enviada: "${d2.seedEnviada}")`, d2.treino && d2.seedEnviada === '');
  const d3 = await jogarCodigo('q9w8e7');
  check('duelo: outro código continua valendo', !d3.treino && d3.seedEnviada === 'q9w8e7');

  // quem cria o código (campanha normal) também já gastou a primeira tentativa
  const criador = await jogarCodigo('');
  const volta = await jogarCodigo(criador.seed);
  check(`duelo: quem criou o código e volta pelo link joga treino (${criador.seed})`, !criador.desafio && volta.desafio && volta.treino);

  // o desafio do dia continua igual, com a mesma chave de antes no aparelho
  const hoje = abrirPagina({ armazenamento }).run('dailySeed()');
  const dia1 = await jogarCodigo(hoje), dia2 = await jogarCodigo(hoje);
  check('desafio do dia: primeira conta, segunda é treino', !dia1.treino && dia2.treino);
  check('desafio do dia: a chave no aparelho continua esquadrao-dia-<código>', armazenamento['esquadrao-dia-' + hoje] === '1');

  console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERRO:', e.stack); process.exit(1); });
