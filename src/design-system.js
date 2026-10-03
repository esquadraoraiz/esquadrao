/* Cópia de components/bundle.js do design system (versão 9): encaixe do nome real na ficha do craque. Não editar aqui. */
/* Esquadrão Raiz · utilitários do design system (sem dependências).
   window.EsquadraoRaiz.encaixarNome(el)  — encaixa um nome real no espaço da carta.
   window.EsquadraoRaiz.corDaSilhueta(hex) — "escura" ou "clara" para o campo da arte. */
window.EsquadraoRaiz = window.EsquadraoRaiz || {};
(function (ns) {
  var PARTICULAS = { da: 1, de: 1, do: 1, das: 1, dos: 1, e: 1 };

  function palavras(nome) { return String(nome || '').trim().split(/\s+/).filter(Boolean); }

  /* "Paulo Roberto Falcão" -> "P. R. Falcão"; partículas (da, de, dos) somem. */
  function abreviar(nome) {
    var p = palavras(nome);
    if (p.length < 2) return nome;
    var ultimo = p[p.length - 1];
    var iniciais = p.slice(0, -1).filter(function (w) { return !PARTICULAS[w.toLowerCase()]; })
      .map(function (w) { return w.charAt(0) + '.'; });
    return iniciais.concat(ultimo).join(' ');
  }

  function cabe(el, linhas) {
    if (el.scrollWidth > el.clientWidth + 0.5) return false;
    if (linhas > 1) {
      var cs = getComputedStyle(el);
      var lh = parseFloat(cs.lineHeight) || parseFloat(el.style.fontSize) * 1.05;
      var conteudo = el.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      return conteudo <= Math.ceil(lh * linhas) + 1;
    }
    return true;
  }

  /* Cascata: nome completo em cada tamanho de data-passos (do maior ao piso),
     depois prenomes abreviados, depois data-curto (apelido / nome de escalação),
   depois o curto abreviado.
     Nunca quebra palavra, nunca usa reticências, nunca desce do último passo. */
  ns.encaixarNome = function (el) {
    if (!el.hasAttribute('data-nome')) el.setAttribute('data-nome', el.textContent);
    var nome = el.getAttribute('data-nome');
    ['width', 'maxWidth', 'transform', 'transformOrigin', 'whiteSpace']
      .forEach(function (p) { el.style[p] = ''; });
    var curto = el.getAttribute('data-curto') || palavras(nome).slice(-1)[0];
    var linhas = +(el.getAttribute('data-linhas') || 1);
    var passos = (el.getAttribute('data-passos') || '').split(',').map(parseFloat).filter(function (n) { return n > 0; });
    if (!passos.length) passos = [parseFloat(getComputedStyle(el).fontSize)];
    var candidatos = [nome, abreviar(nome), curto, abreviar(curto)].filter(function (c, i, a) { return c && a.indexOf(c) === i; });
    for (var c = 0; c < candidatos.length; c++) {
      for (var s = 0; s < passos.length; s++) {
        el.textContent = candidatos[c];
        el.style.fontSize = passos[s] + 'px';
        if (cabe(el, linhas)) {
          el.setAttribute('data-encaixe', ['completo', 'abreviado', 'curto', 'curto-abreviado'][c] || 'curto');
          if (c > 0) el.setAttribute('title', nome);
          return candidatos[c];
        }
      }
    }
    /* Último recurso: condensar o menor candidato até 80% da largura (a fonte já é
       condensada, então até aí ainda lê). Abaixo disso o dado está errado: avise o DEV. */
    var menor = candidatos[candidatos.length - 1];
    el.textContent = menor;
    el.style.fontSize = passos[passos.length - 1] + 'px';
    el.style.whiteSpace = 'nowrap';
    var largura = el.scrollWidth, livre = el.clientWidth, razao = livre / largura;
    if (razao >= 0.8) {
      el.style.maxWidth = 'none';
      el.style.width = (100 / razao).toFixed(2) + '%';
      el.style.transform = 'scaleX(' + razao.toFixed(3) + ')';
      el.style.transformOrigin = '0 50%';
      el.setAttribute('data-encaixe', 'condensado');
      if (menor !== nome) el.setAttribute('title', nome);
      return menor;
    }
    el.setAttribute('data-encaixe', 'estourou');
    if (window.console) console.warn('[EsquadraoRaiz] nome não cabe; revise o nome curto:', nome);
    return el.textContent;
  };

  ns.encaixarTodos = function (raiz) {
    var lista = (raiz || document).querySelectorAll('.er-nome[data-nome]');
    for (var i = 0; i < lista.length; i++) ns.encaixarNome(lista[i]);
  };

  function lum(hex) {
    var h = hex.replace('#', ''), r = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
  }
  /* Silhueta em tinta (#1b1a14) quando ela dá 3:1 com o campo; senão, silhueta em papel. */
  ns.corDaSilhueta = function (hex) {
    var l = lum(hex), tinta = lum('#1b1a14');
    return (l + 0.05) / (tinta + 0.05) >= 3 ? 'clara' : 'escura';
  };
})(window.EsquadraoRaiz);
