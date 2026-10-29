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

`js/systems/rogue.js` implementa nove cavernas em três ciclos, usando o
mesmo `Game`, `Player`, `EnemyMgr`, combate, XP e botim de Survivor. `layout`
gera uma máscara determinista de chão para seis seções e corredores, incluindo
duas rotas até a saída e um laço de tesouro. `World.setArena` recebe essa máscara
como `dungeon`, usada por terreno, colisões, projéteis e navegação; ela é reconstruída
localmente pela semente, sem enviar todos os tiles pela rede. Spawner infinito,
eventos e Sentença ficam desativados nessa expedição. O anfitrião ativa as hordas
quando qualquer humano descobre uma seção, controla o tesouro e abre a saída
após concluir sua câmara. Quando há guardião, seu identificador permite detectar
a derrota independentemente dos inimigos comuns restantes. A saída fica oculta
até então e usa os quatro quadros do sprite nativo `rift`. `canExit` exige um humano vivo próximo da fenda aberta;
a bênção selecionada só é aplicada ao trocar de caverna. A semente, seções,
estado da porta e bênçãos entram nos quadros e no retrato de entrada tardia.
Cada jogador aplica cada bênção uma só vez;
bots que retornam recebem as bênçãos que perderam. Escala e categoria de chefe
também são transmitidas. O campo `room.mode` vale `survival`, `rogue`, `arena` ou `beatup`;
apenas o anfitrião muda entre Survivor/Rogue antes da run, em Windows e Android.

Rogue limita a equipe a dois Pokémon. Os dois servidores normalizam sua lista
de vagas para um parceiro, anunciam `capacity: 2` e recusam um terceiro humano.
Trocar de Survivor para Rogue com mais de dois humanos falha sem alterar a sala;
com um convidado, sua posição é remapeada para a vaga 1. O convidado substitui
o bot dessa vaga e, ao sair, devolve a vaga ao bot. A preparação e a sincronização
dos bots também respeitam esse limite, sem alterar `save.bots` ou seu treinamento.

Arena e sobrevivência usam `Input.axis`, incluindo `Touch` e `Pad`. `Touch.attach`
troca o canvas ativo, limpa o joystick e registra eventos uma única vez por
canvas. Arena desenha o mesmo joystick e respeita posição, tamanho e modo fixo
ou flutuante dos ajustes. Fechar a Arena devolve a superfície ao canvas de `Game`.

Na Arena, `Tournament` executa uma torre fixa de sete encontros: quatro duplas, dois subchefes e um chefe. `ENCOUNTERS` define quantidade de rivais, HP, dificuldade, escala e limite de tempo. O anfitrião simula todos os encontros, inclusive os avisos e explosões dos chefes; não há chaves simuladas. Os quadros incluem os três lutadores das etapas 2v1, avisos e progresso da torre. A prorrogação reduz a mesma porcentagem de HP, evitando vantagem pelo HP extra dos chefes. `Tournament` calcula o dash pelo atributo `spd` do catálogo e controla direção, distância e recarga no anfitrião. Os clientes enviam somente a intenção de usar dash ou lançar maçã, junto do movimento. Cada lutador começa sem reserva: coletar uma maçã cura 25% do HP e deixa uma unidade guardada. A maçã lançada segue exclusivamente o parceiro vivo da mesma dupla, cura 25% do HP e não gera reserva para o alvo. A reserva continua entre lutas da mesma torre e é descartada na seguinte. As teclas de dash e maçã ficam nos ajustes locais, preservando os quatro atalhos de ataque anteriores.

No Survivor, `Player` executa o dash com a velocidade efetiva e verifica colisões em passos de até 8 pixels. `survivor-actions.js` mantém a reserva e os lançamentos em memória, limpa tudo a cada run e fornece os botões e atalhos compartilhados com a Arena. A coleta de maçãs cura 25% do HP. O anfitrião autoriza cada gasto da reserva, escolhe um aliado ferido até 900 pixels (humanos antes de bots) e simula o voo. A cura de humanos remotos é encaminhada ao cliente dono do HP; receber a cura não cria maçãs. Os quadros de rede incluem reserva, voos e estado visual do dash.

`js/systems/arena-powers.js` mantém os poderes da Arena em `save.arenaTraining`, por Pokémon, com quatro ataques equipados. A migração preserva saves anteriores e a mesclagem reúne os poderes aprendidos. Compras usam o saldo local de moedas; os convidados enviam somente os quatro identificadores equipados. O anfitrião valida a compatibilidade com o Pokémon e calcula dano e recarga pelo catálogo local. O conjunto fica fixo durante o campeonato, separado dos ataques da sobrevivência e do treino dos bots.

`npm run build` gera o jogo, monta os arquivos Electron em `.runtime/desktop-package`, verifica a integridade do pacote e produz um único executável em `dist/desktop`. O túnel é incluído no pacote. O usuário final não precisa de Node.js.

A pasta `.runtime` contém apenas ferramentas, caches e saídas intermediárias. A pasta `dist/desktop/PokeSurvivor-data` pode conter o progresso real do usuário e deve ser preservada.

## Beat ’em up

`js/systems/beatup.js` simula uma campanha independente de três fases laterais,
com dois grupos e um chefe em cada uma. Câmera, bloqueios de avanço, golpes por
faixa, combos, caixas quebráveis, pontuação e resgate do parceiro são controlados
pelo anfitrião. A campanha reutiliza as regras de entrada, dash, maçã, cura e
eventos de `ArenaRules`, sem usar o torneio ou a progressão da Arena.
`js/ui/beatup-art.js` compõe os cenários urbanos com pixels e tiles nativos.

`createFightUI` cria duas telas independentes, `ArenaUI` e `BeatupUI`, com estado,
seleção, canvas e mensagens próprios. Compartilham seleção de Pokémon, treino de
poderes, atalhos, controles de toque/controle físico e apresentação dos sprites.
O Beat ’em up usa `#beatup=` e mensagens `beatup-ready`, `beatup-input` e
`beatup-frame`. Os servidores Windows e Android limitam a sala a dois humanos e
bloqueiam entrada e troca de modo durante a campanha. Ao desconectar, o parceiro
vira bot. Saves e moedas não recebem uma nova estrutura de persistência.

## Escopo atual

Este fork não usa as páginas de divulgação, o domínio, as contas, os rankings remotos, a moderação ou as doações do projeto original. O suporte a convidados por navegador permanece parte do aplicativo.
