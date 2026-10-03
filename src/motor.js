/* Esquadrão Raiz · motor do jogo
   Regra, dados e sorteio com semente, sem tela. Roda igual no navegador (antes do script do jogo)
   e no Node (testes e, no futuro, a validação do ranking no servidor, B09).
   Regras deste arquivo:
   - não toca em document, window, localStorage nem Math.random;
   - todo sorteio vem de rng(semente, chave);
   - texto cosmético (grito de gol, autor do gol, narração) fica na tela.
   O estado da campanha (G) e da partida (M) é passado como parâmetro; o motor não guarda estado próprio.
   Script clássico, sem import/export, por causa do Content-Security-Policy atual. */
var Motor = (function(){
'use strict';

/* ===================== DADOS ===================== */
const CARDS = {
  toque:{n:'Toque',atk:2,tag:'toque',d:'Passe de pé em pé.'},
  tabela:{n:'Tabela',atk:3,tag:'toque',d:'Toca e vai.'},
  drible:{n:'Drible',atk:4,tag:'drible',d:'Deixa o marcador no chão.'},
  elastico:{n:'Elástico',atk:5,tag:'drible',d:'Pra fora, pra dentro.'},
  lancamento:{n:'Lançamento',atk:5,tag:'lancamento',d:'Bola longa nas costas.'},
  cruzamento:{n:'Cruzamento',atk:3,tag:'cruzamento',d:'Na cabeça do 9.'},
  chute:{n:'Chute',atk:4,tag:'chute',d:'Bate firme.'},
  falta:{n:'Falta',atk:5,tag:'bola',d:'Bola parada perto da área.'},
  chutefora:{n:'Chute de fora',atk:6,lo:1,hi:11,risk:true,tag:'chute',d:'Sorteia de 1 a 11 na hora do chute.'},
  bicicleta:{n:'Bicicleta',atk:6,lo:0,hi:12,risk:true,binary:true,tag:'chute',d:'Tudo ou nada: vale 12 ou 0.'},
  desarme:{n:'Desarme',def:4,tag:'defesa',d:'Bote certo.'},
  carrinho:{n:'Carrinho',def:6,tag:'defesa',d:'Na bola, juiz!'},
  paredao:{n:'Paredão',def:5,tag:'defesa',d:'Goleiro fecha o gol.'},
  cera:{n:'Cera',def:2,tag:'catimba',d:'DEF 2 e o próximo ataque deles perde 3.'},
  escanteio:{n:'Escanteio',atk:3,tag:'bola',extra:1,d:'Próximo lance com 7 cartas na mão.'},
  triangulacao:{n:'Triangulação',atk:2,tag:'toque',count:2,d:'Conta como 2 toques no Tiki-taka.'},
  lencol:{n:'Lençol',atk:3,tag:'drible',flat:2,d:'Por cima da zaga: +2 que não depende do combo.'},
  pressao:{n:'Pressão alta',def:2,tag:'defesa',press:3,d:'Segurou o ataque deles? Próximo lance +3 de ataque.'},
  voleio:{n:'Voleio',atk:6,lo:3,hi:9,risk:true,tag:'chute',d:'Sorteia de 3 a 9 na hora do chute.'},
  cavadinha:{n:'Cavadinha',atk:5,lo:1,hi:10,risk:true,binary:true,tag:'chute',d:'Tudo ou nada: vale 10 ou 1.'},
  saida:{n:'Saída do goleiro',def:5,lo:0,hi:10,risk:true,tag:'defesa',d:'Sorteia de 0 a 10 de defesa.'}
};
const START_DECK = ['toque','toque','toque','tabela','tabela','drible','drible','lancamento','cruzamento','chute','chutefora','desarme','desarme','paredao'];
const SHOP_POOL = ['falta','elastico','carrinho','cera','lancamento','chute','tabela','cruzamento','drible','falta','paredao','chutefora','bicicleta','escanteio','triangulacao','lencol','pressao','voleio','cavadinha','saida'];
const PRICE = {chutefora:3,bicicleta:4,falta:4,elastico:4,carrinho:3,cera:3,lancamento:3,chute:3,tabela:2,cruzamento:2,drible:3,paredao:3,escanteio:3,triangulacao:3,lencol:3,pressao:3,voleio:3,cavadinha:3,saida:3};

/* Craques: efeitos por carta (card) e por jogada (play).
   r = raridade (L lendário, R raro, C comum), calculada pelo Índice Raiz da planilha de craques; fact = fato real da figurinha. */
const BAL={prize:8}; // prêmio base por vitória (calibrado na simulação)
/* Categorias do lance (D5): Gol ≥ 1× a zaga, Golaço ≥ 2×, Pintura ≥ 3×, sempre contra a zaga de ANTES do gol.
   Prêmio extra na próxima janela (só se vencer o jogo): Golaço +R$ 2, Pintura +R$ 5.
   Pontos do ranking (B02): 500 + 1.000 por vitória + espetáculo, que fica entre 0 e 999. */
const CAT={golaco:2, pintura:3};
const CAT_PREMIO={golaco:2, pintura:5};
const PONTOS={largada:500, vitoria:1000, saldo:10, gol:5, golaco:20, pintura:50, tetoEspetaculo:999};
const RAR={L:{n:'Lendário',w:1,p:[9,11]},R:{n:'Raro',w:2,p:[7,9]},C:{n:'Comum',w:3,p:[5,7]}};
function wsample(r, arr, n){ const pool=arr.slice(), out=[];
  while(out.length<n && pool.length){ const tot=pool.reduce((a,c)=>a+RAR[c.r||'C'].w,0); let x=r()*tot, i=0;
    for(;i<pool.length-1;i++){ x-=RAR[pool[i].r||'C'].w; if(x<0) break; } out.push(pool.splice(i,1)[0]); }
  return out; }
const CRAQUES = [
  {id:'zico', r:'L', fact:"Artilheiro do Brasileirão em 1980 e 1982, com 21 gols", n:'Zico', club:'Flamengo · anos 80', c1:'#C8102E', c2:'#fff', e:'Falta vale +6. Chega com 2 Faltas para o deck.', card:c=>c.t==='falta'?{atk:6}:null, onHire:(G,mk)=>G.deck.push(mk('falta'),mk('falta'))},
  {id:'romario', r:'L', fact:"Bola de Ouro 2000 e campeão brasileiro pelo Vasco", n:'Romário', club:'Vasco · 2000', c1:'#111', c2:'#fff', e:'Chute vale +5 de ataque.', card:c=>CARDS[c.t].tag==='chute'?{atk:5}:null},
  {id:'edmundo', r:'L', fact:"Artilheiro do Brasileirão 1997 com 29 gols em 28 jogos", n:'Edmundo', club:'Vasco · 1997', c1:'#111', c2:'#fff', e:'Cada drible vale +4.', card:c=>CARDS[c.t].tag==='drible'?{atk:4}:null},
  {id:'dada', r:'R', fact:"Fez o gol do título brasileiro de 1971 contra o Botafogo", n:'Dadá Maravilha', club:'Atlético-MG · 1971', c1:'#111', c2:'#fff', e:'Cruzamento +5. Combo Cabeçada vira x2,2. Traz 1 Cruzamento.', card:c=>c.t==='cruzamento'?{atk:5}:null, combo:{cabecada:2.2}, onHire:(G,mk)=>G.deck.push(mk('cruzamento'))},
  {id:'ceni', r:'L', fact:"Goleiro tricampeão brasileiro (2006–08) e Bola de Ouro 2008", n:'Rogério Ceni', club:'São Paulo · 2006–08', c1:'#E30613', c2:'#fff', e:'+1 de defesa em toda jogada. Falta +2.', card:c=>c.t==='falta'?{atk:2}:null, play:()=>({def:1})},
  {id:'marcelinho', r:'R', fact:"57 dos seus 206 gols pelo Corinthians foram de falta", n:'Marcelinho Carioca', club:'Corinthians · anos 90', c1:'#111', c2:'#fff', e:'Jogada com Falta ganha x1,5 extra. Chega com 2 Faltas para o deck.', mult:cs=>cs.some(c=>c.t==='falta')?1.5:1, onHire:(G,mk)=>G.deck.push(mk('falta'),mk('falta'))},
  {id:'alex', r:'R', fact:"Bola de Ouro 2003: 23 gols no Brasileirão da Tríplice Coroa", n:'Alex', club:'Cruzeiro · 2003', c1:'#0033A0', c2:'#fff', e:'Toque e Tabela valem +2.', card:c=>CARDS[c.t].tag==='toque'?{atk:2}:null},
  {id:'falcao', r:'L', fact:"Tricampeão brasileiro pelo Inter: 1975, 1976 e 1979", n:'Falcão', club:'Internacional · 1979', c1:'#E30613', c2:'#fff', e:'+1 de ataque e +1 de defesa em toda jogada.', play:()=>({atk:1,def:1})},
  {id:'socrates', r:'C', fact:"Mestre do calcanhar: 172 gols pelo Corinthians", n:'Sócrates', club:'Corinthians · anos 80', c1:'#111', c2:'#fff', e:'Calcanhar: Tabela vale o dobro e Toque +1.', card:c=>c.t==='tabela'?{atk:3}:(c.t==='toque'?{atk:1}:null)},
  {id:'rivellino', r:'C', fact:"Fez do drible elástico sua marca registrada", n:'Rivellino', club:'Fluminense · anos 70', c1:'#7A1E3B', c2:'#fff', e:'Elástico +3. Combo Jogo Bonito vira x2. Traz 2 Elásticos.', card:c=>c.t==='elastico'?{atk:3}:null, combo:{bonito:2}, onHire:(G,mk)=>G.deck.push(mk('elastico'),mk('elastico'))},
  {id:'dinamite', r:'R', fact:"Maior artilheiro da história do Brasileirão: 190 gols", n:'Roberto Dinamite', club:'Vasco · maior artilheiro do Brasileirão', c1:'#111', c2:'#fff', e:'+2 de ataque por gol seu já marcado no jogo (máx. +6).', play:(cs,st)=>({atk:Math.min(2*st.my,6)})},
  {id:'fred', r:'R', fact:"Artilheiro do Brasileirão 2012: 20 gols no título do Flu", n:'Fred', club:'Fluminense · 2012', c1:'#7A1E3B', c2:'#fff', e:'Cruzamento e Chute valem +3.', card:c=>(c.t==='cruzamento'||CARDS[c.t].tag==='chute')?{atk:3}:null},
  {id:'marcos', r:'R', fact:"Pegou 33 pênaltis em jogos oficiais pelo Palmeiras", n:'Marcos', club:'Palmeiras · São Marcos', c1:'#006437', c2:'#fff', e:'Cartas de defesa valem +1. Nos pênaltis, eles erram mais.', card:c=>CARDS[c.t].tag==='defesa'?{def:1}:null, penSave:true},
  {id:'junior', r:'L', fact:"Jogador com mais jogos na história do Flamengo", n:'Júnior', club:'Flamengo · anos 80', c1:'#C8102E', c2:'#fff', e:'Lançamento +4. Desarme +2.', card:c=>c.t==='lancamento'?{atk:4}:(c.t==='desarme'?{def:2}:null)},
  {id:'gabigol', r:'R', fact:"Artilheiro e campeão do Brasileirão 2019 com 25 gols", n:'Gabigol', club:'Flamengo · 2019', c1:'#C8102E', c2:'#fff', e:'Chute +2. Cada gol rende R$ 1 a mais.', card:c=>CARDS[c.t].tag==='chute'?{atk:2}:null, cash:1},
  {id:'ronaldo', r:'C', fact:"Campeão Paulista e da Copa do Brasil pelo Timão em 2009", n:'Ronaldo', club:'Corinthians · 2009', c1:'#111', c2:'#fff', e:'Fenômeno: risco sorteia 2 vezes e fica com o melhor. Chute +3. Traz 1 Bicicleta.', card:c=>CARDS[c.t].tag==='chute'?{atk:3}:null, riskBest:true, onHire:(G,mk)=>G.deck.push(mk('bicicleta'))},
  {id:'neymar', r:'C', fact:"Prêmio Puskás 2011 com golaço contra o Flamengo", n:'Neymar', club:'Santos · 2011', c1:'#222', c2:'#fff', e:'Risco nunca tira menos de 5. Drible +2. Traz 1 Chute de fora.', card:c=>CARDS[c.t].tag==='drible'?{atk:2}:null, riskFloor:5, onHire:(G,mk)=>G.deck.push(mk('chutefora'))},
  {id:'ronaldinho', r:'R', fact:"Bola de Ouro do Brasileirão 2012 pelo Atlético-MG", n:'Ronaldinho', club:'Atlético-MG · 2013', c1:'#111', c2:'#fff', e:'Drible também conta como Toque nos combos. Drible e Toque +1.', card:c=>['drible','toque'].includes(CARDS[c.t].tag)?{atk:1}:null, alias:{drible:'toque'}},
  {id:'petkovic', r:'C', fact:"Seu escanteio gerou o gol do título brasileiro de 2009", n:'Petković', club:'Flamengo · 2009', c1:'#C8102E', c2:'#fff', e:'Bola parada conta como Cruzamento (Falta + Chute = Cabeçada). Bola parada +3. Traz 1 Falta e 1 Escanteio.', card:c=>CARDS[c.t].tag==='bola'?{atk:3}:null, alias:{bola:'cruzamento'}, onHire:(G,mk)=>G.deck.push(mk('falta'),mk('escanteio'))},
  {id:'renato', r:'R', fact:"Gol de barriga deu o Carioca de 1995 ao Fluminense", n:'Renato Gaúcho', club:'Fluminense · 1995', c1:'#7A1E3B', c2:'#fff', e:'Gol de barriga: 1 vez por jogo, ataque até 4 abaixo da zaga vira gol. +1 de ataque por jogada.', play:()=>({atk:1}), barriga:4},
  {id:'evair', r:'C', fact:"Marcou 126 gols em 245 jogos pelo Palmeiras", n:'Evair', club:'Palmeiras · 1993', c1:'#006437', c2:'#fff', e:'Chute +4. Nos pênaltis, seus batedores nunca chutam para fora.', card:c=>CARDS[c.t].tag==='chute'?{atk:4}:null, penSure:true},
  {id:'rai', r:'C', fact:"Fez os 2 gols do São Paulo na final do Mundial de 1992", n:'Raí', club:'São Paulo · 1992', c1:'#E30613', c2:'#fff', e:'Jogadas com até 2 cartas: x1,5, +2 de ataque e +1 de defesa.', mult:cs=>cs.length<=2?1.5:1, play:cs=>cs.length<=2?{atk:2,def:1}:{}},
  {id:'edilson', r:'R', fact:"Fez as embaixadinhas na final do Paulista de 1999", n:'Edílson', club:'Corinthians · 1999', c1:'#111', c2:'#fff', e:'Cera tira 5 do ataque deles. Drible +3 e Carrinho +2. Traz 1 Cera.', card:c=>c.t==='carrinho'?{def:2}:(CARDS[c.t].tag==='drible'?{atk:3}:null), cera:5, onHire:(G,mk)=>G.deck.push(mk('cera'))}
];

/* Adversários históricos do Brasileirão */
const TEAMS = {
  1:[
    {n:'Guarani 1978', c1:'#006437', c2:'#fff', ink:'#fff', star:'Careca', zaga:10, atk:[3,6], pass:0.55, f:'Campeão brasileiro de 1978.'},
    {n:'Bahia 1988', c1:'#0067B1', c2:'#E30613', ink:'#fff', star:'Bobô', zaga:11, atk:[3,6], pass:0.55, f:'Campeão brasileiro de 1988.'},
    {n:'Athletico-PR 2001', c1:'#C8102E', c2:'#111', ink:'#fff', star:'Alex Mineiro', zaga:10, atk:[3,6], pass:0.55, f:'Campeão brasileiro de 2001.'},
    {n:'Atlético-MG 1971', c1:'#111', c2:'#fff', ink:'#fff', star:'Dadá Maravilha', zaga:11, atk:[3,6], pass:0.55, f:'O primeiro campeão brasileiro.'}
  ],
  2:[
    {n:'Vasco 1997', c1:'#111', c2:'#fff', ink:'#fff', star:'Edmundo', zaga:13, atk:[5,8], pass:0.4, f:'Edmundo fez 29 gols no campeonato.'},
    {n:'Fluminense 2012', c1:'#7A1E3B', c2:'#00613C', ink:'#fff', star:'Fred', zaga:14, atk:[5,8], pass:0.4, f:'Campeão com Fred artilheiro.'},
    {n:'Corinthians 2015', c1:'#111', c2:'#fff', ink:'#fff', star:'Renato Augusto', zaga:13, atk:[5,8], pass:0.4, f:'Campeão brasileiro de 2015.'},
    {n:'Santos 2002', c1:'#f2f2f2', c2:'#111', ink:'#111', star:'Robinho', zaga:14, atk:[5,8], pass:0.4, f:'Os meninos da Vila de Robinho e Diego.'}
  ],
  3:[
    {n:'São Paulo 2007', c1:'#E30613', c2:'#111', ink:'#fff', star:'Rogério Ceni', zaga:18, atk:[6,9], pass:0.35, f:'Parte do tricampeonato de 2006 a 2008.'},
    {n:'Internacional 1979', c1:'#E30613', c2:'#fff', ink:'#fff', star:'Falcão', zaga:19, atk:[6,9], pass:0.35, f:'Campeão invicto em 1979.'},
    {n:'Palmeiras 2023', c1:'#006437', c2:'#fff', ink:'#fff', star:'Endrick', zaga:18, atk:[6,9], pass:0.35, f:'Campeão brasileiro de 2023.'},
    {n:'Botafogo 2024', c1:'#111', c2:'#fff', ink:'#fff', star:'Luiz Henrique', zaga:19, atk:[6,9], pass:0.35, f:'Campeão brasileiro de 2024.'}
  ],
  4:[
    {n:'Flamengo 2019', c1:'#C8102E', c2:'#111', ink:'#fff', star:'Gabigol', zaga:20, atk:[5,9], pass:0, boss:'Blitz rubro-negra: ataca em todos os lances.', f:'Campeão com 90 pontos e Gabigol artilheiro.'},
    {n:'Cruzeiro 2003', c1:'#0033A0', c2:'#fff', ink:'#fff', star:'Alex', zaga:23, atk:[5,9], pass:0.3, boss:'Time dos 100 pontos: a zaga se fecha +5 a cada gol seu, em vez de +3.', grow:5, f:'Tríplice coroa e 100 pontos no Brasileirão.'}
  ]
};
const CONDITIONS = [
  {n:'Chuva forte', d:'Lançamento -3, Drible -1.', card:c=>c.t==='lancamento'?{atk:-3}:(CARDS[c.t].tag==='drible'?{atk:-1}:null)},
  {n:'Casa cheia', d:'+2 de ataque em toda jogada.', play:()=>({atk:2})},
  {n:'Calor de 40 graus', d:'A partir dos 60 minutos, -3 de ataque por jogada.', play:(cs,st)=>st.block>=4?{atk:-3}:{}},
  {n:'Gramado esburacado', d:'Toque -1.', card:c=>CARDS[c.t].tag==='toque'?{atk:-1}:null},
  null, null
];

/* ===================== SORTEIO COM SEMENTE ===================== */
/* A mesma semente gera a mesma campanha (adversários, condições, ofertas, baralho, ataques deles, cartas de risco, pênaltis) */
function hash32(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); return (h^h>>>16)>>>0; }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function rng(seed, key){ return mulberry32(hash32(seed+'|'+key)); }
const rpick=(r,a)=>a[Math.floor(r()*a.length)];
const rri=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const rshuffle=(r,a)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

/* ===================== CAMPANHA ===================== */
// Cada carta do deck ganha um id único na campanha (G.uid conta a partir de 0 em cada campanha nova)
function mk(G, t){ G.uid=(G.uid||0)+1; return {id:G.uid,t}; }
// Estado inicial da campanha. A tela acrescenta o que é dela (nome do time, desafio, desafio do dia).
function novaCampanha(seed){
  const G={cash:6, deck:[], craques:[], stage:0, results:[], seed, uid:0};
  G.deck=START_DECK.map(t=>mk(G,t));
  const r=rng(seed,'sched'); G.schedule=[rpick(r,TEAMS[1]),rpick(r,TEAMS[2]),rpick(r,TEAMS[3]),rpick(r,TEAMS[4])];
  return G;
}
function ofertasDraft(G){ return wsample(rng(G.seed,'draft'), CRAQUES, 3); }
function contratar(G, c){ G.craques.push(c); if(c.onHire) c.onHire(G, t=>mk(G,t)); }
function oppFor(G, stage){
  if(stage<4) return G.schedule[stage];
  G.endlessOpp = G.endlessOpp || {};
  if(!G.endlessOpp['s'+stage]){
    const r=rng(G.seed,'sched'+stage), k=stage-3, base=rpick(r,[...TEAMS[3],...TEAMS[4]]);
    G.endlessOpp['s'+stage] = {...base, zaga: 19 + 3*k + (r()<.5?0:1), atk:[5+k, 9+k], pass: base.pass===0 ? 0 : Math.max(0, .3-.05*k), grow: base.grow||3, endless:true};
  }
  return G.endlessOpp['s'+stage];
}

/* ===================== PARTIDA ===================== */
// Estado inicial da partida, já com a primeira mão e o primeiro ataque deles. A tela acrescenta seleção e narração.
function novaPartida(G){
  const t = oppFor(G, G.stage);
  const cond = G.stage===3 ? null : rpick(rng(G.seed,'cond'+G.stage), CONDITIONS);
  const deckR = rng(G.seed,'deck'+G.stage);
  const M = {t, cond, zaga:t.zaga, my:0, op:0, block:0, subs:3, extra:0, press:0, pressNext:0, barrigaUsed:false, hist:[], deckR, draw:rshuffle(deckR, G.deck.slice()), disc:[], hand:[], debuff:0, intent:0, over:false};
  fill(M); rollIntent(G, M);
  return M;
}
function drawOne(M){ if(!M.draw.length){ M.draw=rshuffle(M.deckR, M.disc); M.disc=[]; } return M.draw.pop(); }
function fill(M, min){ const goal=Math.max(min||0, 6+(M.extra||0)); M.extra=0; while(M.hand.length<goal){ const c=drawOne(M); if(!c) break; M.hand.push(c); } }
// Ataque deles no lance atual
function rollIntent(G, M){
  const t=M.t, r=rng(G.seed,'int'+G.stage+'-'+M.block); let a = r()<t.pass ? 0 : rri(r,t.atk[0],t.atk[1]);
  if(a>0 && r()<.15) a+=3;
  a = Math.max(0,a-M.debuff); M.debuff=0; M.intent=a;
}
function hasK(G, k){ return G && G.craques.some(c=>c[k]); }
function riskFloor(G){ const c=G && G.craques.find(c=>c.riskFloor); return c?c.riskFloor:0; }
function riskVal(G, M, c, mode){
  const b=CARDS[c.t], f=riskFloor(G), lo=Math.max(b.lo,f), hi=Math.max(b.hi,f);
  if(mode==='min') return lo; if(mode==='max') return hi;
  if(mode==='roll' && M.rolls && M.rolls[c.id]!==undefined) return M.rolls[c.id];
  return Math.max(b.atk!==undefined?b.atk:b.def, f);
}
/* Cartas de risco sorteiam pela semente da campanha. A chave inclui a fase, o lance e as cartas jogadas juntas:
   todos que fazem a mesma jogada no mesmo lance tiram o mesmo valor (justo no desafio e reproduzível para validar o ranking),
   mas mudar a jogada muda o sorteio, então não dá para "decorar" o resultado de uma carta. */
function riskRngs(G, M, cards){
  const base='risco'+G.stage+'-'+M.block+'-'+cards.map(c=>c.t).sort().join('+'), seen={};
  // cada carta tem o próprio sorteio (tipo + ocorrência), para a ordem de escolha não trocar os valores entre cartas
  return cards.map(c=>{ seen[c.t]=(seen[c.t]||0)+1; return rng(G.seed, base+'|'+c.t+'#'+seen[c.t]); });
}
function rollRisk(G, c, r){ const b=CARDS[c.t], f=riskFloor(G);
  const one=()=> b.binary ? (r()<.5 ? b.hi : b.lo) : rri(r,b.lo,b.hi);
  let v=one(); if(hasK(G,'riskBest')) v=Math.max(v,one()); return Math.max(v,f); }
function baseAtk(G, M, c, mode){
  const b=CARDS[c.t]; if(!b.risk) return b.atk||0;
  return riskVal(G, M, c, mode);
}
// Renato Gaúcho: 1 vez por jogo, a zaga efetiva fica menor
function zagaFor(G, M){ const c=G.craques.find(c=>c.barriga); return M.zaga - (c && !M.barrigaUsed ? c.barriga : 0); }
// Avalia uma jogada. mode: undefined (valor de referência), 'min', 'max' ou 'roll' (usa o sorteio do lance, M.rolls)
function evaluate(G, M, cards, mode){
  const st={my:M.my, block:M.block};
  let atk=0, def=0, hasAtk=false, hasDef=false, flat=0;
  const mods=[...G.craques, M.cond].filter(Boolean);
  for(const c of cards){
    const b=CARDS[c.t]; let a=baseAtk(G, M, c, mode), d=(b.risk && b.def!==undefined) ? riskVal(G, M, c, mode) : (b.def||0);
    if(b.flat) flat+=b.flat;
    for(const m of mods){ if(m.card){ const r=m.card(c); if(r){ a+=r.atk||0; d+=r.def||0; } } }
    if(b.atk!==undefined){hasAtk=true; atk+=Math.max(0,a);} if(b.def){hasDef=true; def+=Math.max(0,d);}
  }
  if(cards.length){
    for(const m of mods){ if(m.play){ const r=m.play(cards,st); atk+=r.atk||0; def+=r.def||0; } }
    if(hasAtk && M.press) atk+=M.press;
  }
  atk=Math.max(0,atk); def=Math.max(0,def);
  const cb = combo(G, cards);
  let mult = cb.m;
  for(const m of G.craques){ if(m.mult) mult*=m.mult(cards); }
  const total = hasAtk ? Math.round(atk*mult)+flat : 0;
  return {atk,def,mult,total,flat,combo:cb.name,hasAtk,hasDef};
}
// Combos: vale o maior
function combo(G, cards){
  // n conta com os "apelidos" de craques (Ronaldinho: drible também é toque; Petković: bola parada também é cruzamento); raw conta só a carta
  const n={}, raw={}, al={}; ((G&&G.craques)||[]).forEach(k=>{ if(k.alias) Object.assign(al,k.alias); });
  cards.forEach(c=>{ const b=CARDS[c.t], g=b.tag, k=b.count||1; n[g]=(n[g]||0)+k; raw[g]=(raw[g]||0)+k; if(al[g]) n[al[g]]=(n[al[g]]||0)+k; });
  const over = k=>{ for(const c of G.craques){ if(c.combo&&c.combo[k]) return c.combo[k]; } return null; };
  const list=[];
  if((n.toque||0)>=3) list.push({name:'Tiki-taka',m:2});
  if((n.drible||0)>=2) list.push({name:'Jogo Bonito',m:over('bonito')||1.5});
  if(n.cruzamento && n.chute) list.push({name:'Cabeçada',m:over('cabecada')||1.6});
  if(raw.bola && (raw.chute||raw.cruzamento)) list.push({name:'Ensaiada',m:1.5});
  if(n.defesa && n.lancamento) list.push({name:'Contra-ataque',m:1.5});
  if(n.drible && n.chute) list.push({name:'Pintou um quadro',m:1.5});
  if(n.toque && n.chute) list.push({name:'Tabela e finaliza',m:1.4});
  if(!list.length) return {name:'',m:1};
  return list.sort((a,b)=>b.m-a.m)[0];
}
// Valor de uma carta com os bônus de craques e condição (o que a carta mostra na mão)
function cardEff(G, M, c){
  const b=CARDS[c.t]; let a=b.atk||0, d=b.def||0;
  const mods=[...G.craques, M&&M.cond].filter(Boolean);
  for(const m of mods){ if(m.card){ const r=m.card(c); if(r){ a+=r.atk||0; d+=r.def||0; } } }
  return {atk:Math.max(0,a), def:Math.max(0,d)};
}
// Combos possíveis com até 3 cartas da mão: [[nome, multiplicador], ...]
function handCombos(G, M){
  const h=M.hand, n=h.length, found=new Map();
  for(let m=1;m<(1<<n);m++){ const s=[]; for(let i=0;i<n;i++) if(m&(1<<i)) s.push(h[i]); if(s.length>3) continue;
    const cb=combo(G, s); if(cb.name && (!found.has(cb.name) || found.get(cb.name)<cb.m)) found.set(cb.name,cb.m); }
  return [...found.entries()].sort((a,b)=>b[1]-a[1]);
}
// Troca cartas da mão sem gastar o lance. As trocadas vão para o descarte depois de completar a mão.
function substituir(M, ids){
  const out=M.hand.filter(c=>ids.has(c.id)), n0=M.hand.length;
  M.hand=M.hand.filter(c=>!ids.has(c.id)); M.subs--; fill(M, n0); M.disc.push(...out);
  return out;
}
/* Resultado do lance: sorteia o risco, decide o gol seu e o deles e aplica os efeitos (zaga, cera, pressão, escanteio).
   Avança o lance. Devolve o que a tela precisa para narrar e animar. A mão nova e o próximo ataque deles
   vêm depois, com fill(M) e rollIntent(G, M), para a tela mostrar a animação antes. */
function jogarLance(G, M, cards){
  // As cartas valem na ordem da mão (é como a tela sempre jogou). A ordem decide a ordem do descarte, que é reembaralhado
  // quando o baralho acaba; assim a mesma jogada dá sempre o mesmo resultado, e carta que não está na mão é ignorada.
  { const sel=new Set(cards.map(c=>c.id)); cards=M.hand.filter(c=>sel.has(c.id)); }
  M.rolls={}; const rolls=[]; const rr=riskRngs(G, M, cards);
  cards.forEach((c,k)=>{ const b=CARDS[c.t]; if(!b.risk) return;
    const v = rollRisk(G, c, rr[k]); M.rolls[c.id]=v; rolls.push({n:b.n, v, hi:Math.max(b.hi,riskFloor(G))}); });
  const ev=evaluate(G, M, cards,'roll');
  const h={g:false,c:false}, zagaAntes=M.zaga, intent=M.intent;
  // nosso ataque
  const barriga = ev.hasAtk && ev.total<M.zaga && ev.total>=zagaFor(G, M);
  if(ev.hasAtk && (ev.total>=M.zaga || barriga)){
    if(barriga) M.barrigaUsed=true;
    M.my++; h.g=true;
    M.zaga+=M.t.grow||3;
  }
  const trave = ev.hasAtk && !h.g && ev.total>=zagaAntes*0.75;
  // ataque deles
  if(M.intent>0 && !(ev.def>=M.intent)){ M.op++; h.c=true; }
  const cera = cards.some(c=>c.t==='cera');
  if(cera){ const ed=G.craques.find(k=>k.cera); M.debuff=ed?ed.cera:3; }
  M.press=0;
  const pressao = cards.some(c=>CARDS[c.t].press) && M.intent>0 && ev.def>=M.intent;
  if(pressao) M.pressNext=3;
  M.press=M.pressNext; M.pressNext=0;
  M.extra=Math.min(1, cards.reduce((a,c)=>a+(CARDS[c.t].extra||0),0)); // mão de no máximo 7 cartas
  const ids=new Set(cards.map(c=>c.id));
  M.hand=M.hand.filter(c=>!ids.has(c.id)); M.disc.push(...cards);
  // categoria do lance: null sem ataque; 'defendeu' quando a zaga segurou; gol de barriga é sempre 'gol'
  h.ataque = ev.hasAtk ? ev.total : 0; h.zaga = zagaAntes;
  h.cat = !ev.hasAtk ? null : !h.g ? 'defendeu' : barriga ? 'gol' : ev.total>=zagaAntes*CAT.pintura ? 'pintura' : ev.total>=zagaAntes*CAT.golaco ? 'golaco' : 'gol';
  M.hist[M.block]=h;
  M.block++;
  return {ev, rolls, h, gol:h.g, conc:h.c, barriga, trave, cat:h.cat, zagaAntes, zagaDepois:M.zaga, intent, cera, pressao};
}

/* ===================== PÊNALTIS ===================== */
function novaDisputa(){ return {me:[],op:[],turn:'me',done:false}; }
// 'me', 'op' ou null (ainda sem vencedor)
function pensDecided(P){
  const a=P.me.filter(Boolean).length, b=P.op.filter(Boolean).length, ra=5-P.me.length, rb=5-P.op.length;
  if(P.me.length<=5 && P.op.length<=5){ if(a+Math.max(0,ra)<b) return 'op'; if(b+Math.max(0,rb)<a) return 'me'; }
  if(P.me.length>=5 && P.me.length===P.op.length && a!==b) return a>b?'me':'op';
  return null;
}
function penSig(M, P){
  const lances=M.hist.map(h=>(h&&h.g?1:0)+(h&&h.c?2:0)).join('');
  const disputa=P.me.map(x=>x?1:0).join('')+'-'+P.op.map(x=>x?1:0).join('');
  return `${M.my}x${M.op}|${lances}|${disputa}|${P.turn}`;
}
/* Uma cobrança. canto: 0 esquerda, 1 meio, 2 direita (onde você bate, ou para onde seu goleiro pula).
   Pênaltis sorteiam pela semente, mas a chave inclui o histórico do jogo (placar, lance a lance) e da disputa até aqui.
   Assim a mesma partida dá os mesmos pênaltis (desafio justo, ranking validável), e quem repete o desafio só "decora"
   o goleiro se refizer exatamente o mesmo jogo. O canto escolhido não entra na chave, para não dar para testar cantos. */
function cobranca(G, M, P, canto){
  const kr=rng(G.seed, 'pen'+G.stage+'|'+penSig(M, P)); const r=kr(); const other = r<1/3?0:r<2/3?1:2;
  const quem=P.turn; let ok;
  if(quem==='me'){ ok = canto!==other && (hasK(G,'penSure') || kr()<.92); P.me.push(ok); P.turn='op'; }
  else { ok = canto!==other && kr()<(hasK(G,'penSave')?.75:.9); P.op.push(ok); P.turn='me'; }
  return {quem, ok, other, decidido: pensDecided(P)};
}

/* ===================== RESULTADO, PRÊMIO E JANELA ===================== */
// Prêmio extra das categorias no jogo (Golaço e Pintura), pago na janela se vencer
function premioCategorias(M){
  return M.hist.reduce((a,h)=>a+((h&&CAT_PREMIO[h.cat])||0),0);
}
function premio(G, M, pens){
  let prize = BAL.prize + Math.min(M.my,3) + (pens?0:1);
  const gb = G.craques.find(c=>c.cash); if(gb) prize += gb.cash*M.my;
  return prize + premioCategorias(M);
}
// Registra o jogo na campanha e paga o prêmio se ganhou. Devolve o prêmio (0 na derrota).
function registrarResultado(G, M, win, pens){
  const score = `${M.my}x${M.op}${pens?' (pên)':''}`;
  G.results.push({t:M.t.n, score, win, gf:M.my, ga:M.op, hist:M.hist.slice(), stage:G.stage});
  if(!win) return 0;
  const prize = premio(G, M, pens);
  G.cash += prize; G.lastPrize=prize;
  return prize;
}
/* Ofertas da janela de transferências. rolls = quantas vezes trocou as ofertas nesta janela.
   Ofertas já compradas continuam no lugar. */
function ofertasJanela(G, rolls, cOffers, kOffers){
  const k=G.stage+(rolls?'-'+rolls:'');
  const own=new Set(G.craques.map(c=>c.id));
  const keepC=(cOffers||[]).filter(o=>o.sold), keepK=(kOffers||[]).filter(o=>o.sold);
  // ordem sorteada sobre a lista inteira e só depois filtrada: quem tem craques diferentes vê a mesma sequência de ofertas
  const order = wsample(rng(G.seed,'shopc'+k), CRAQUES, CRAQUES.length);
  return {
    cOffers: keepC.concat(order.filter(c=>!own.has(c.id) && !keepC.some(o=>o.c.id===c.id)).slice(0, 3-keepC.length)
      .map(c=>({c,price:rri(rng(G.seed,'price'+k+c.id),...RAR[c.r||'C'].p)}))),
    kOffers: keepK.concat(rshuffle(rng(G.seed,'shopk'+k), SHOP_POOL.slice()).slice(0,4-keepK.length).map(t=>({t,price:PRICE[t]})))
  };
}
// Pontos do ranking: 500 + 1.000 por vitória + 10 por gol de saldo + 1 por gol. A mesma fórmula está em firestore.rules.
// Contagem das categorias e do maior lance a partir do histórico dos jogos (G.results[].hist)
function lancesDaCampanha(G){
  let golaco=0, pintura=0, maiorLance=0;
  for(const r of G.results) for(const h of (r.hist||[])){ if(!h) continue;
    if(h.cat==='golaco') golaco++; if(h.cat==='pintura') pintura++; if((h.ataque||0)>maiorLance) maiorLance=h.ataque; }
  return {golaco, pintura, maiorLance};
}
/* Pontos do ranking (B02): 500 + 1.000 por vitória + espetáculo.
   espetáculo = 10 × saldo + 5 × gol + 20 × golaço + 50 × pintura, limitado a 0..999 (cada gol numa categoria só).
   Pênaltis contam como vitória, mas os gols da disputa não entram (gf e ga são do tempo normal).
   A mesma conta está em firestore.rules. O maior lance fica fora da soma. */
function pontuacao(G){
  const wins=G.results.filter(r=>r.win).length;
  const gf=G.results.reduce((a,r)=>a+(r.gf||0),0), ga=G.results.reduce((a,r)=>a+(r.ga||0),0);
  const {golaco, pintura, maiorLance}=lancesDaCampanha(G);
  const gols=gf-golaco-pintura;
  const bruto=PONTOS.saldo*(gf-ga) + PONTOS.gol*gols + PONTOS.golaco*golaco + PONTOS.pintura*pintura;
  const espetaculo=Math.max(0, Math.min(PONTOS.tetoEspetaculo, bruto));
  return {stage:wins, champion:wins>=4, gf, ga, golaco, pintura, espetaculo, maiorLance, score:PONTOS.largada+PONTOS.vitoria*wins+espetaculo};
}

return {
  // dados
  CARDS, START_DECK, SHOP_POOL, PRICE, BAL, RAR, CRAQUES, TEAMS, CONDITIONS, CAT, CAT_PREMIO, PONTOS,
  // sorteio
  hash32, mulberry32, rng, rpick, rri, rshuffle, wsample,
  // campanha
  mk, novaCampanha, ofertasDraft, contratar, oppFor,
  // partida
  novaPartida, drawOne, fill, rollIntent, hasK, riskFloor, riskVal, riskRngs, rollRisk, baseAtk, zagaFor,
  evaluate, combo, cardEff, handCombos, substituir, jogarLance,
  // pênaltis
  novaDisputa, pensDecided, penSig, cobranca,
  // resultado
  premio, premioCategorias, registrarResultado, ofertasJanela, lancesDaCampanha, pontuacao
};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Motor;
