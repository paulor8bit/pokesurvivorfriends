# Arquitetura do fork

**Responsável:** Paulinho Ricardo — gatinho.punkeca. A base do jogo é de JPTER78, com licenças e créditos originais preservados.

## Aplicativo e convidados

O iniciador Windows abre o Electron a partir de um cache por versão. Uma segunda abertura recupera a janela existente. O Electron mantém o servidor local em `localhost:8790` e abre uma sessão de túnel temporário. Os convidados recebem apenas os arquivos públicos do jogo e a conexão de salas.

`server/game-server.js` mantém salas e participantes em memória, limita a sala a quatro jogadores e encaminha sinalização e mensagens autorizadas. `server/online-session.js` controla o servidor e o processo do túnel. Não existe cadastro ou banco de dados remoto.

## Jogo e persistência

`dev.html` define as telas e a ordem dos módulos. `tools/build.js` combina e minifica os módulos com Terser, gera `index.html` e atualiza a versão para os clientes do navegador.

`js/core/db.js` salva o progresso localmente e mantém as chaves e migrações dos saves anteriores. Os dados do aplicativo ficam fora dos arquivos imutáveis do jogo. Atualizar o executável não deve remover esse perfil.

`js/core/calendar.js` mantém o cálculo dos períodos usado pelas missões anteriores. Ele foi separado do antigo ranking remoto para preservar o calendário dos salvamentos.

`js/net/guest-rooms.js` implementa identidade temporária e salas sem conta. `net.js` e `coop.js` controlam a conexão WebRTC e a simulação cooperativa, com retransmissão pelo anfitrião quando necessário.

Jogar sempre abre uma sala: anfitrião no slot 0 e três configurações de bot ou convite. Windows (`server/room-catalog.js`) e Android (`RoomHub`) atribuem uma vaga livre reservada para amigo antes de substituir um bot. Apenas humanos contam para o limite de quatro. A configuração original fica sob o ocupante humano, permitindo restaurar o bot quando ele sair. Cada partida possui identificador e seed próprios, e a sala continua aceitando convidados enquanto ela acontece.

O anfitrião envia a quem entra um retrato do relógio, nível, bioma, clima, eventos, arenas e perigos; os quadros seguintes incluem os bots e definições de inimigos, objetos e obstáculos já quebrados perto do jogador. A entrada preserva a partida dos participantes atuais. Bots substituídos ficam em reserva na memória até o fim da partida, mantendo nível, ataques e experiência para um eventual retorno.

A sala mantém somente um catálogo público `{ dex, shiny }` do anfitrião, sem copiar seu save. A escolha é temporária e não altera `save.partner` nem a coleção do convidado. Clientes instalados conectam o WebSocket ao endereço do convite e mantêm a página na origem local, usando suas melhorias locais quando a fonte escolhida é a própria coleção. Servidores Windows e Android aceitam essa origem local e validam os empréstimos contra o catálogo da sala.

## Distribuição

`npm run build` gera o jogo, monta os arquivos Electron em `.runtime/desktop-package`, verifica a integridade do pacote e produz um único executável em `dist/desktop`. O túnel é incluído no pacote. O usuário final não precisa de Node.js.

A pasta `.runtime` contém apenas ferramentas, caches e saídas intermediárias. A pasta `dist/desktop/PokeSurvivor-data` pode conter o progresso real do usuário e deve ser preservada.

## Escopo atual

Este fork não usa as páginas de divulgação, o domínio, as contas, os rankings remotos, a moderação ou as doações do projeto original. O suporte a convidados por navegador permanece parte do aplicativo.
