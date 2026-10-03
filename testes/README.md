# Testes

Testes em Node puro, sem dependências. Rodam a lógica do jogo direto de `src/index.html`, com uma página falsa mínima.

```bash
node testes/sorteios.test.js   # cartas de risco e pênaltis seguem a semente
node testes/campanha.test.js   # mesma semente + mesmas escolhas = mesma campanha, lance a lance
```

Os dois terminam com `TODOS OS TESTES PASSARAM`. Rode antes de abrir um pull request que mexa em sorteio, regra ou pontuação.
