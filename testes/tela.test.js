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

  // ---------- Apelido do ranking (B19) ----------
  {
    const fs = require('fs');
    const p = abrirPagina();
    const regras = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
    const naRegra = [...regras.matchAll(/team\.lower\(\)\.matches\('([^']*)'\)/g)].map(m => m[1]);
    check('apelido: as expressões do jogo são as mesmas do firestore.rules', naRegra.length === 2 && naRegra[0] === p.run('APELIDO_LINK') && naRegra[1] === p.run('APELIDO_PROIBIDO'));
    const okNome = n => p.run(`apelidoOk(${JSON.stringify(n)})`);
    check('apelido: nomes comuns passam', ['Real Pelada', 'Galácticos do Bairro', 'Macaca de Campinas', 'E.C. Bahia 88'].every(okNome));
    check('apelido: link, palavrão, vazio e longo demais são recusados', !['vem.me', 'https://x', 'Porra FC', 'Os Viado', '   ', 'x'.repeat(25)].some(okNome));
    // no fim da campanha, nome proibido abre o campo para trocar e trava o botão de publicar
    const q = abrirPagina();
    q.run(`window.rankEnabled=()=>true; newRun('apelid'); G.name='Porra FC'; G.craques.push(CRAQUES[0]); startMatch(); M.over=true; G.results.push({t:'X',score:'0x1',win:false,gf:0,ga:1,hist:[],stage:0}); runOver(false);`);
    check('apelido: no fim da campanha, nome proibido mostra o campo e trava o botão', q.run(`app.innerHTML.includes('Esse nome não pode entrar no ranking')`) && q.run(`document.getElementById('rankSend').disabled === true`));
  }

  // ---------- Narração do lance (B25) ----------
  {
    const p = abrirPagina();
    const r = JSON.parse(p.run(`(function(){
      const out={jogos:0, gols:{gol:0,golaco:0,pintura:0}, fora:[], repetidas:0, anguloNoGol:0, trave:0, corta:0, outrasLinhas:[]};
      for(let s=0;s<40;s++){
        newRun('narra'+s); Motor.contratar(G, CRAQUES.find(c=>c.id===(s%2?'zico':'socrates'))); startMatch();
        while(!M.over && M.block<6){ const h=M.hand.slice().sort((a,b)=>cardEff(b).atk-cardEff(a).atk).slice(0,(s%3)+1); M.sel.clear(); h.forEach(c=>M.sel.add(c.id)); playBlock(); }
        out.jogos++; const vistas={};
        for(const l of M.log){ const t=l.txt.replace(/<[^>]+>/g,'');
          if(l.cls==='goal'){ const cat=/^GOLAÇO!/.test(t)?'golaco':/^PINTURA!/.test(t)?'pintura':'gol'; out.gols[cat]++;
            const f=NARRA[cat].find(x=>t.includes(' '+x)); if(!f) out.fora.push(t);
            if(cat==='gol' && t.includes('acerta o ângulo')) out.anguloNoGol++;
            if(f){ const k=cat+f; if(vistas[k]) out.repetidas++; vistas[k]=1; } }
          else if(/: \\d+ contra \\d+\\.$/.test(t) && NARRA.trave.some(x=>t.startsWith(x+':'))) out.trave++;
          else if(/\\. \\d+ contra \\d+\\.$/.test(t) && !/^Gol do|tenta, mas/.test(t)){ if(NARRA.corta.some(x=>t.startsWith(x.replace('{time}',M.t.n)+'.'))) out.corta++; else out.outrasLinhas.push(t); }
        }
      }
      return JSON.stringify(out); })()`));
    check(`narração: ${r.jogos} jogos, gols ${JSON.stringify(r.gols)}, todos com frase da lista da categoria`, r.fora.length === 0 && r.gols.golaco > 0);
    if (r.fora.length) console.log('      fora da lista:', r.fora.slice(0, 3));
    check('narração: "acerta o ângulo" nunca no gol comum', r.anguloNoGol === 0);
    check('narração: nenhuma frase de gol repete no mesmo jogo', r.repetidas === 0);
    check(`narração: trave (${r.trave}) e zaga corta (${r.corta}) com as frases do B25`, r.trave + r.corta > 0 && r.outrasLinhas.length === 0);
    if (r.outrasLinhas.length) console.log('      linhas não reconhecidas:', r.outrasLinhas.slice(0, 3));
  }

  console.log(ok ? '\nTODOS OS TESTES PASSARAM' : '\nHÁ FALHAS');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERRO:', e.stack); process.exit(1); });
