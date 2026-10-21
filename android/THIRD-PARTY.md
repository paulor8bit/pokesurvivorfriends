# Bibliotecas da versão Android

Fork: Paulinho Ricardo — gatinho.punkeca. Projeto original: JPTER78/pokesurvivor.
As licenças e os créditos do jogo acompanham o APK.

NanoHTTPD / NanoWSD 2.3.1: Copyright NanoHTTPD contributors, BSD 3-Clause.
Fonte e licença: https://github.com/NanoHttpd/nanohttpd/tree/nanohttpd-project-2.3.1
O arquivo NanoWSD.java possui adaptação deste fork para limitar quadros e
mensagens fragmentadas a 256 KiB.
O handshake WebSocket omite Content-Length na resposta 101 para preservar a
conexão através de proxies e túneis HTTP.

cloudflared: Copyright Cloudflare, Inc., Apache License 2.0.
Fonte e licença: https://github.com/cloudflare/cloudflared
O executável oficial Linux é empacotado como biblioteca executável. O caminho
de resolução DNS é adaptado para /proc/self/fd/0; a entrada é um arquivo privado
com os servidores DNS da conexão Android. Não é necessária conta Cloudflare.
