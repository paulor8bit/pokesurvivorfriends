# PokeSuvivor Friends

Fork independente criado por **Paulinho Ricardo — gatinho.punkeca**, baseado no [PokéSurvivor de JPTER78](https://github.com/JPTER78/pokesurvivor).

Repositório deste fork: [paulor8bit/pokesurvivorfriends](https://github.com/paulor8bit/pokesurvivorfriends).

O foco deste projeto é um aplicativo Windows para jogar solo ou criar salas temporárias com até quatro jogadores. Os amigos entram pelo navegador usando um link e um apelido. Não há cadastro, banco de dados remoto ou sincronização de contas.

## Baixar e instalar

- **[Baixar para Windows x64](https://github.com/paulor8bit/pokesurvivorfriends/releases/latest/download/PokeSurvivor-Online-1.5.0-x64.exe)** — aplicativo portátil; baixe e abra o executável. Mantenha a pasta de dados criada ao lado dele para preservar o progresso.
- **[Baixar APK Android](https://github.com/paulor8bit/pokesurvivorfriends/releases/latest/download/PokeSurvivor-Android.apk)** — versão de teste para Android 8 ou superior, ARM64. Instale o APK no celular; veja [as instruções e limitações](docs/ANDROID.md).
- [Todas as versões e arquivos de verificação](https://github.com/paulor8bit/pokesurvivorfriends/releases).

Não é necessário baixar o código-fonte nem instalar Node.js para jogar.

## Jogar

Abra `PokéSurvivor Online.lnk`, `Jogar.bat` ou o executável em `dist/desktop`.
Escolha **Survivor**, **Rogue**, **Arena** ou **Beat ’em up** na tela inicial. No Survivor, escolha **Bot** ou **Amigo convidado** para cada uma das três vagas; o Rogue tem uma vaga de parceiro. Nesses dois modos você pode começar sozinho e compartilhar o convite durante a partida. Um amigo ocupa uma vaga livre ou substitui um bot; o limite é de quatro humanos no Survivor e dois no Rogue. O computador do anfitrião e o aplicativo precisam permanecer abertos. O túnel gratuito gera um endereço temporário, que muda ao reiniciar.

O progresso do anfitrião permanece nos dados locais do aplicativo. **Não apague `dist/desktop/PokeSurvivor-data`**: ela pode conter seu salvamento. Para convidados, cada endereço temporário tem seu próprio armazenamento no navegador.

Instruções completas: [Jogar online](docs/JOGAR-ONLINE.md).

Convidados podem escolher iniciais ou Pokémon emprestados da coleção do anfitrião. Quem já joga no próprio aplicativo pode colar o link completo em **Jogar → Entrar por convite** e selecionar **Minha coleção**, usando suas melhorias e seu ataque inicial salvos. Os empréstimos não desbloqueiam Pokémon no salvamento do convidado.

## Rogue · Cavernas

Abra **Rogue** no menu ou escolha **Rogue** no seletor de modo da
sala. São **nove cavernas em três ciclos**: cada ciclo tem uma caverna fácil,
uma média com subchefe e uma com chefe maior com ataques avisados no chão.
As cavernas de musgo, cristais e brasas usam os terrenos, Pokémon, efeitos e
sons do jogo, com uma nova música de exploração. A dificuldade cresce a cada ciclo.

Cada caverna tem seis seções: entrada, salão, duas galerias com rotas alternativas,
alcova de tesouro e câmara da saída. As hordas aparecem ao descobrir cada sala;
o mapa mostra a exploração compartilhada e a posição dos amigos. É possível
explorar os desvios e voltar por caminhos diferentes. Na câmara da saída,
vença a horda para fazer surgir uma fenda animada. Se houver subchefe ou chefe,
basta derrotá-lo para a fenda aparecer, mesmo que restem inimigos comuns.
Antes disso, a saída não aparece no cenário. Atravesse a fenda para levar a
equipe à próxima caverna. Os bots não acionam a saída.
Uma bênção opcional pode ser escolhida antes de atravessar; sem escolha,
aplica-se a primeira opção. Ela não teleporta os jogadores. As bênçãos, os
níveis e os ataques continuam durante a expedição; a próxima run começa no
nível 1. Atravessar a nona fenda conclui a expedição. Se todos os jogadores humanos caírem, ela termina.
Moedas e recompensas coletadas seguem o salvamento local habitual.

O Rogue aceita **no máximo dois Pokémon na equipe: você e um amigo ou bot**.
Há uma única vaga de parceiro. Convidados podem chegar durante a partida para
substituir o bot; ao sair, o bot volta. Um terceiro jogador não pode entrar.
Esse limite vale no Windows e no Android. A equipe salva de Survivor e seus
treinamentos são preservados. Dash e maçãs compartilhadas também funcionam. O anfitrião
escolhe o modo antes de começar, controla as hordas e escolhe a bênção da equipe.

## Beat ’em up

Modo próprio no menu, inspirado nos jogos de avanço lateral como Streets of Rage.
Escolha seu Pokémon e um bot ou convide um amigo antes de começar. Avancem juntos
para a direita, vençam os grupos para liberar o caminho e enfrentem os três chefes:
Machamp na Praça Verdante, Gengar nas Docas da Meia-Noite e Tyranitar na Avenida das Brasas.

Use WASD, setas, joystick de toque ou controle para se mover. Num 1 faz combos,
Num 2 aplica um golpe forte, Num 3 faz uma investida e Num 4 ativa o especial.
Os golpes atingem rivais próximos na mesma faixa; o especial acerta ao redor.
Espaço usa o dash, e E lança uma maçã ao parceiro ferido. Todos os atalhos podem
ser alterados nos ajustes e também têm botões na tela.

Quebre caixas para encontrar maçãs e fique perto do parceiro caído por alguns
segundos para ajudá-lo. Se os dois caírem, a aventura acaba. Entre fases, a dupla
recupera parte do HP. Pontuação e maior combo aparecem ao terminar.
Usa os sprites, efeitos e sons do jogo, com cenários urbanos e música própria.
Os poderes equipados são compartilhados com a Arena. O convite usa `#beatup=`;
a sala comporta dois jogadores e fecha a entrada ao iniciar. Se o amigo sair,
um bot assume até o fim da aventura.

## Arena 2 × 2

**Dash e maçã também funcionam no Survivor.** Use Espaço para o dash e E para
lançar uma maçã, ou os dois botões na tela. Os atalhos são compartilhados com
a Arena e podem ser alterados em Configurações → Controles. O dash usa a
velocidade atual do Pokémon, incluindo melhorias, e respeita os obstáculos.
Cada run começa sem maçãs: coletar uma cura 25% do HP e guarda uma unidade
para alimentar um aliado ferido próximo. O lançamento prioriza amigos e,
na falta deles, pode curar um bot. Receber uma maçã cura 25% do HP e não cria
outra maçã. Só é possível guardar uma por vez.

No menu, abra **Arena 2 × 2** para subir uma torre de sete lutas em sequência:
quatro duplas rivais, dois subchefes (Machamp e Lucario) e Mewtwo como chefe
final. As primeiras lutas são 2 contra 2; contra subchefes e chefe, sua dupla
enfrenta um único rival mais forte, em 2 contra 1. Escolha seu Pokémon e forme
dupla com um bot ou crie um convite para um amigo. Todos os desafios são jogados,
e a torre marca cada vitória. Um amigo que desconecta é substituído por um bot.

A seleção usa uma grade de personagens no estilo dos jogos de luta, com
retratos grandes dos dois integrantes da dupla. Escolha **P1** ou **P2** e
clique em um Pokémon; também pode navegar com as setas e confirmar com Enter.
O combate reutiliza os terrenos, sprites, efeitos dos golpes, partículas,
ícones, música e sons do próprio jogo.

Mova com WASD, setas, controle físico ou o mesmo joystick de Survivor/Rogue:
flutuante ao tocar e arrastar no cenário, ou fixo conforme os ajustes de controles.
No controle físico, A/B/X/Y usam os ataques, LB usa dash e RB lança maçã.
Os quatro ataques são
manuais: clique/toque nos botões no canto inferior direito ou use **Num 1–4**.
Em **Configurações → Controles → Arena**, clique na tecla para alterá-la; as
preferências ficam neste dispositivo. Cada ataque tem sua própria recarga.
Os ataques miram o rival mais próximo: disparo, rajada, investida e explosão.

Use **Dash** ou **Espaço** para avançar na direção do movimento (parado, segue
a direção em que o Pokémon está virado). Pokémon mais rápidos avançam mais,
com maior velocidade e menor recarga. O botão mostra quando o dash está pronto.
O alcance e a recarga aparecem na preparação da Arena.

Maçãs aparecem durante a luta e recuperam **25% do HP** de quem as pega,
incluindo os rivais.
Você começa o campeonato sem maçãs guardadas. Ao pegar uma, além da cura,
guarda **uma maçã** para lançar ao parceiro com **E** ou **Maçã**. Ela segue o
aliado e recupera **25% do HP**, sem reviver nem gerar outra maçã. A reserva
comporta uma maçã e continua entre rodadas do mesmo campeonato; não vai para
o próximo campeonato. Dash e lançamento têm teclas configuráveis em Controles.

Uma dupla perde quando os dois Pokémon caem. Cada rodada
começa com HP completo. Após 90 segundos (120 contra chefes) começa a prorrogação
com perda da mesma porcentagem de HP para todos;
um empate permite repetir a batalha. Participar do campeonato é grátis.
Em **Aprender e equipar poderes**, compre ataques por **150 moedas** para o
Pokémon escolhido e configure as quatro teclas antes de começar. As compras
ficam salvas por Pokémon; trocar poderes aprendidos é grátis. A loja também
permite treinar o parceiro bot. Cada convidado leva os próprios poderes,
sem compartilhar moedas ou compras com o anfitrião. O treinamento da Arena
é separado dos ataques e melhorias da sobrevivência. O anfitrião deve manter o
aplicativo aberto; ao sair, a sala é encerrada.

Os rivais têm tempo de reação e usam um ataque por vez, dividindo os alvos
entre os integrantes da sua dupla. A dificuldade cresce ao subir a torre.
Subchefes e chefe alternam o alvo e têm golpes especiais com círculos no chão:
saia deles antes da explosão. Eles têm mais HP e sprites maiores; a barra de
vida do chefe também aparece no topo. Há uma
breve proteção de 0,22 s entre golpes para evitar dano concentrado instantâneo.
As vantagens e resistências de tipo são moderadas nas primeiras rodadas.
A primeira maçã cai após 5 segundos; as seguintes aparecem a cada 6–9 segundos.

## Aplicativo Android

O APK em `dist/android/PokeSurvivor-Android.apk` permite jogar solo sem internet
e hospedar salas no próprio celular, com convites pela internet ou pelo Wi-Fi.
Requer Android 8 ou superior e processador ARM64. Mantenha o jogo aberto no
celular anfitrião. Instalação, limitações e compilação: [Android](docs/ANDROID.md).

## Desenvolver

Requisitos: Windows x64 e Node.js para desenvolvimento. Quem usa o executável pronto não precisa instalar Node.js. A geração do iniciador usa o compilador .NET Framework disponível no Windows.

```sh
npm ci
npm start
npm test
npm run build
```

| Comando | Uso |
| --- | --- |
| `npm start` | Abrir o aplicativo Electron em desenvolvimento |
| `npm run serve` | Servir o jogo localmente; `dev.html` carrega os módulos separados |
| `npm run online` | Abrir uma sessão pelo navegador com túnel temporário |
| `npm run build:game` | Gerar `index.html`, `js/app.min.js` e `version.json` |
| `npm run build` | Gerar o jogo e o executável Windows em `dist/desktop` |
| `npm test` | Verificar salvamento, salas e ciclo de vida do acesso online |
| `npm run test:browser` | Validar convite e partida real em dois navegadores Edge sem interface |
| `npm run test:arena` | Validar ataques manuais, chaves, cura, atalhos, celular e dupla por convite |

Edite `dev.html` e os módulos de `js/`. Os arquivos gerados são reconstruídos pelo processo de build. Não é necessário manter as páginas, domínio, Firebase ou sistema de doações do projeto original.

## Organização

```text
electron/       janela, interface desktop e iniciador Windows
server/         arquivos públicos, salas temporárias e túnel
js/             jogo, dados, interface e cooperativo
css/            estilos do jogo
assets/         sprites, fontes e ícones utilizados pelo jogo
tests/          verificações automatizadas
tools/          build e manutenção dos dados e recursos
docs/           guias deste fork e referência de jogabilidade
dev.html        fonte das telas e ordem dos módulos
index.html      página gerada para distribuição
dist/desktop/   executável atual e dados locais: não apagar salvamentos
.runtime/       arquivos temporários de desenvolvimento, fora do Git
```

Veja [Arquitetura](docs/ARQUITETURA.md) e [AGENTS.md](AGENTS.md) para as regras de manutenção.

## Autoria e licenças

- **Fork:** Paulinho Ricardo — gatinho.punkeca.
- **Projeto original:** JPTER78, com autoria e avisos preservados em [LICENSE](LICENSE).
- **Código:** [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md), conforme a licença herdada.
- **Sprites, fontes, dados e música:** veja [CREDITS.md](CREDITS.md).

Projeto de fã sem fins comerciais, sem vínculo com Nintendo, Creatures, GAME FREAK ou The Pokémon Company. Este fork não representa o site oficial do projeto original.
