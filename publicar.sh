#!/bin/bash
# Publica a versão mais nova do Esquadrão Raiz e limpa as antigas.
set -e
shopt -s nullglob
cd ~

# 1) Acha o arquivo mais novo enviado (zip ou 7z)
ARQS=(~/esquadrao*.zip ~/esquadrao*.7z)
if [ ${#ARQS[@]} -eq 0 ]; then
  echo "Nenhum esquadrao*.zip encontrado na pasta inicial. Faça o upload primeiro."; exit 1
fi
NOVO=""
for f in "${ARQS[@]}"; do
  if [ -z "$NOVO" ] || [ "$f" -nt "$NOVO" ]; then NOVO="$f"; fi
done
echo ">> Versão nova: $(basename "$NOVO")"

# 2) Apaga os uploads antigos (fica só o mais novo)
for f in "${ARQS[@]}"; do
  if [ "$f" != "$NOVO" ]; then echo ">> Apagando upload antigo: $(basename "$f")"; rm -f "$f"; fi
done

# 3) Limpa a pasta do projeto, guardando só a escolha de projeto (.firebaserc)
mkdir -p ~/esquadrao
[ -f ~/esquadrao/.firebaserc ] && cp ~/esquadrao/.firebaserc /tmp/firebaserc.bak
find ~/esquadrao -mindepth 1 -maxdepth 1 ! -name '.firebaserc' -exec rm -rf {} +
echo ">> Pasta ~/esquadrao limpa"

# 4) Extrai a versão nova
case "$NOVO" in
  *.7z) command -v 7z >/dev/null || sudo apt-get install -y p7zip-full >/dev/null
        7z x "$NOVO" -o"$HOME/esquadrao" -y >/dev/null ;;
  *)    unzip -o "$NOVO" -d ~/esquadrao >/dev/null ;;
esac
# se o zip veio com uma pasta dentro, sobe o conteúdo um nível
if [ ! -f ~/esquadrao/firebase.json ]; then
  SUB=$(dirname "$(find ~/esquadrao -name firebase.json | head -n1)")
  [ -n "$SUB" ] && [ "$SUB" != "." ] && cp -a "$SUB"/. ~/esquadrao/ && rm -rf "$SUB"
fi
[ -f /tmp/firebaserc.bak ] && cp /tmp/firebaserc.bak ~/esquadrao/.firebaserc
# o próprio script se atualiza se a versão nova trouxer um publicar.sh diferente
if [ -f ~/esquadrao/publicar.sh ] && ! cmp -s ~/esquadrao/publicar.sh ~/publicar.sh; then
  cp ~/esquadrao/publicar.sh ~/publicar.sh.novo && chmod +x ~/publicar.sh.novo && mv -f ~/publicar.sh.novo ~/publicar.sh
  echo ">> Script publicar.sh atualizado para a próxima vez"
fi
cd ~/esquadrao
[ -f firebase.json ] || { echo "firebase.json não está no arquivo enviado."; exit 1; }

# 5) Projeto do Firebase (só pergunta na primeira vez)
if [ ! -f .firebaserc ] || grep -q 'SEU-PROJETO-ID' .firebaserc; then
  echo ">> Escolha o projeto (quando pedir o alias, digite: default)"; firebase use --add
fi

# 6) Publica site + regras do ranking
firebase deploy --only hosting,firestore || { echo ">> Publicando só o site..."; firebase deploy --only hosting; }

# 7) Apaga o upload usado
rm -f "$NOVO"
echo ""
echo ">> Pronto! Abra https://esquadraoraiz.com.br (ou https://esquadrao-6c167.web.app)"
