# Testes

Testes em Node puro, sem dependências. Carregam a regra do jogo direto de `src/motor.js` (o objeto `Motor`), sem página nem navegador.

```bash
node testes/sorteios.test.js    # cartas de risco e pênaltis seguem a semente; o motor não usa Math.random
node testes/campanha.test.js    # mesma semente + mesmas escolhas = mesma campanha, lance a lance (com pênaltis)
node testes/pontuacao.test.js   # pontos do B02 (500 + 1.000 por vitória + espetáculo 0..999), categorias do lance e a regra do firestore.rules
```

Os três terminam com `TODOS OS TESTES PASSARAM`. Rode antes de abrir um pull request que mexa em sorteio, regra ou pontuação.

`testes/simular.js` joga uma campanha inteira só com o motor, na mesma ordem em que a tela chama as regras. É a base para a validação do ranking no servidor (B09).
