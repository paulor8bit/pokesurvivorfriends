# Jogar online sem conta

1. No computador do anfitrião, abra **dist/desktop/PokeSurvivor-Online-1.0.0-x64.exe**. É um aplicativo portátil: não precisa instalar Node.js nem abrir terminal.
2. O jogo abre em sua própria janela e prepara o acesso online automaticamente. A ferramenta de conexão já está incluída no executável. Não pede conta, domínio, cartão ou chave.
3. Dentro do aplicativo, entre em **Jogar com amigos**, informe um apelido e clique em **Criar sala**.
4. Use **Copiar link** ou **Compartilhar convite** e envie ao amigo pelo WhatsApp.
5. O amigo abre o link no navegador do computador ou celular, escolhe seu Pokémon na primeira visita, informa o apelido e entra na sala. O convite é preservado durante a escolha inicial.
6. Quando todos estiverem conectados, o anfitrião inicia a partida. São até quatro jogadores.

Os arquivos do aplicativo são preparados somente na primeira abertura de cada versão. Depois disso, o executável usa os mesmos arquivos prontos. Abrir novamente enquanto o jogo está em execução recupera sua janela, sem extrair arquivos por cima dela. Use o executável de `dist/desktop` ou o atalho `PokéSurvivor Online` na pasta principal do projeto.

O iniciador mostra o andamento da abertura e registra falhas em `%LOCALAPPDATA%/PokeSurvivor/DesktopLauncher/startup.log`. Neste computador foi autorizado o modo de compatibilidade: se o Electron encerrar antes de abrir a janela com o erro Windows `80000003`, o iniciador tenta novamente com `--no-sandbox`, somente para este jogo. Isso reduz o isolamento do Chromium; não altera o Windows nem outros aplicativos. As restrições de acesso do jogo ao Node e à navegação externa continuam ativas. O parâmetro `--strict-sandbox` desativa essa tentativa adicional.

Se o Windows impedir a gravação na pasta de dados do usuário, o aplicativo usa a pasta `PokeSurvivor-data` ao lado do executável. Nesse caso, mantenha essa pasta junto do aplicativo para preservar seu progresso. O diagnóstico fica em `PokeSurvivor-data/DesktopLauncher/startup.log`.

Depois de uma abertura bem-sucedida em compatibilidade, o iniciador lembra essa escolha nos dados do jogo para as próximas aberturas. `--strict-sandbox` também ignora essa escolha salva.

A janela do jogo confirma diretamente sua inicialização ao iniciador, sem depender de uma consulta de rede a `localhost`.

O código da sala também pode ser digitado em **Jogar com amigos** quando todos acessam o mesmo endereço do túnel. O código sozinho não informa o endereço do computador: envie o link completo na primeira vez.

## Enquanto estiverem jogando

Mantenha o computador e o aplicativo abertos. Fechar o aplicativo do anfitrião encerra a sala, o servidor e o túnel. Salas ficam somente na memória, sem cadastro ou banco de dados. Se o túnel parar, clique em **Tentar novamente** e compartilhe o novo convite. O modo solo continua funcionando enquanto a conexão é recuperada.

O jogo tenta usar WebRTC direto. Se a rede bloquear essa conexão, o computador do anfitrião retransmite os dados pelo túnel, com atualizações menos frequentes. Isso pode aumentar a latência; não é necessário contratar TURN.

O progresso do anfitrião fica salvo nos dados locais do aplicativo e é mantido ao fechar e abrir novamente, mesmo que o link público mude. O aplicativo usa um endereço local fixo e armazenamento próprio. O progresso de sessões anteriores no navegador não é transferido automaticamente para o aplicativo. Para os convidados, cada novo domínio temporário tem seu próprio armazenamento: o progresso não é transferido automaticamente entre links novos. Não limpe os dados do navegador para preservar o salvamento naquele endereço.

O botão **Copiar site** no topo do aplicativo copia o endereço público inicial. Para convidar diretamente para uma sala, use **Copiar link** dentro da sala. O endereço público deixa de funcionar ao fechar o aplicativo.

## Limitações do serviço gratuito

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) não exige conta e gera um endereço HTTPS temporário. É voltado a testes e sessões temporárias, sem garantia de disponibilidade e com até 200 solicitações simultâneas. Não é uma hospedagem permanente. O link muda ao reiniciar.

Somente os arquivos públicos do jogo são servidos: a pasta Git, scripts do computador e dependências não são publicados. A configuração de Firebase do projeto original não é utilizada nesta versão.

## Para desenvolvimento

- `npm start`: abre o aplicativo Electron em desenvolvimento.
- `npm run build`: gera o executável portátil em `dist/desktop`, incluindo a ferramenta de túnel.
- `npm run serve`: abre apenas o servidor local, sem túnel.
- `npm run online`: alternativa de desenvolvimento que usa um terminal e abre o navegador.
- `npm run test:online`: verifica salas, limites, isolamento, reconexão e encerramento do acesso online.
- `npm run build:game`: gera o jogo a partir de `dev.html`.

Não é necessário publicar no GitHub nem usar Firebase. O anfitrião usa o aplicativo Windows e os convidados usam o navegador. APK Android não faz parte deste pacote.
