# PokeSuvivor Friends

Fork independente criado por **Paulinho Ricardo — gatinho.punkeca**, baseado no [PokéSurvivor de JPTER78](https://github.com/JPTER78/pokesurvivor).

Repositório deste fork: [paulor8bit/pokesurvivorfriends](https://github.com/paulor8bit/pokesurvivorfriends).

O foco deste projeto é um aplicativo Windows para jogar solo ou criar salas temporárias com até quatro jogadores. Os amigos entram pelo navegador usando um link e um apelido. Não há cadastro, banco de dados remoto ou sincronização de contas.

## Baixar e instalar

- **[Baixar para Windows x64](https://github.com/paulor8bit/pokesurvivorfriends/releases/latest/download/PokeSurvivor-Online-1.2.0-x64.exe)** — aplicativo portátil; baixe e abra o executável. Mantenha a pasta de dados criada ao lado dele para preservar o progresso.
- **[Baixar APK Android](https://github.com/paulor8bit/pokesurvivorfriends/releases/latest/download/PokeSurvivor-Android.apk)** — versão de teste para Android 8 ou superior, ARM64. Instale o APK no celular; veja [as instruções e limitações](docs/ANDROID.md).
- [Todas as versões e arquivos de verificação](https://github.com/paulor8bit/pokesurvivorfriends/releases).

Não é necessário baixar o código-fonte nem instalar Node.js para jogar.

## Jogar

Abra `PokéSurvivor Online.lnk`, `Jogar.bat` ou o executável em `dist/desktop`.
Entre em **Jogar** e escolha **Bot** ou **Amigo convidado** para cada uma das três vagas. Você pode começar sozinho e compartilhar o convite a qualquer momento. Um amigo que entra durante a partida ocupa uma vaga livre ou substitui um bot; a sala só fica cheia com quatro jogadores humanos. O computador do anfitrião e o aplicativo precisam permanecer abertos. O túnel gratuito gera um endereço temporário, que muda ao reiniciar.

O progresso do anfitrião permanece nos dados locais do aplicativo. **Não apague `dist/desktop/PokeSurvivor-data`**: ela pode conter seu salvamento. Para convidados, cada endereço temporário tem seu próprio armazenamento no navegador.

Instruções completas: [Jogar online](docs/JOGAR-ONLINE.md).

Convidados podem escolher iniciais ou Pokémon emprestados da coleção do anfitrião. Quem já joga no próprio aplicativo pode colar o link completo em **Jogar → Entrar por convite** e selecionar **Minha coleção**, usando suas melhorias e seu ataque inicial salvos. Os empréstimos não desbloqueiam Pokémon no salvamento do convidado.

## Arena 2 × 2

No menu, abra **Arena 2 × 2** para um campeonato com oito duplas: quartas,
semifinal e final. Escolha seu Pokémon e forme dupla com um bot ou crie um
convite para um amigo. As duplas adversárias são bots; as outras chaves são
simuladas. Um amigo que desconecta é substituído por um bot.

A seleção usa uma grade de personagens no estilo dos jogos de luta, com
retratos grandes dos dois integrantes da dupla. Escolha **P1** ou **P2** e
clique em um Pokémon; também pode navegar com as setas e confirmar com Enter.
O combate reutiliza os terrenos, sprites, efeitos dos golpes, partículas,
ícones, música e sons do próprio jogo.

Mova com WASD, setas ou o controle de toque à esquerda. Os quatro ataques são
manuais: clique/toque nos botões no canto inferior direito ou use **Num 1–4**.
Em **Configurações → Controles → Arena**, clique na tecla para alterá-la; as
preferências ficam neste dispositivo. Cada ataque tem sua própria recarga.
Os ataques miram o rival mais próximo: disparo, rajada, investida e explosão.

Maçãs aparecem durante a luta e recuperam **25% do HP** de quem as pega,
incluindo os rivais. Uma dupla perde quando os dois Pokémon caem. Cada rodada
começa com HP completo. Após 90 segundos começa a prorrogação com perda de HP;
um empate permite repetir a batalha. Participar do campeonato é grátis.
Em **Aprender e equipar poderes**, compre ataques por **150 moedas** para o
Pokémon escolhido e configure as quatro teclas antes de começar. As compras
ficam salvas por Pokémon; trocar poderes aprendidos é grátis. A loja também
permite treinar o parceiro bot. Cada convidado leva os próprios poderes,
sem compartilhar moedas ou compras com o anfitrião. O treinamento da Arena
é separado dos ataques e melhorias da sobrevivência. O anfitrião deve manter o
aplicativo aberto; ao sair, a sala é encerrada.

Os rivais têm tempo de reação e usam um ataque por vez, dividindo os alvos
entre os integrantes da sua dupla. As quartas são mais acessíveis; o dano,
ritmo e velocidade dos disparos aumentam na semifinal e na final. Há uma
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
