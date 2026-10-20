# PokéSurvivor Online

Fork independente criado por **Paulinho Ricardo — gatinho.punkeca**, baseado no [PokéSurvivor de JPTER78](https://github.com/JPTER78/pokesurvivor).

Repositório deste fork: [paulor8bit/pokesurvivorfriends](https://github.com/paulor8bit/pokesurvivorfriends).

O foco deste projeto é um aplicativo Windows para jogar solo ou criar salas temporárias com até quatro jogadores. Os amigos entram pelo navegador usando um link e um apelido. Não há cadastro, banco de dados remoto ou sincronização de contas.

## Jogar

Abra `PokéSurvivor Online.lnk`, `Jogar.bat` ou o executável em `dist/desktop`.
Em **Jogar com amigos**, crie uma sala e envie o convite. O computador do anfitrião e o aplicativo precisam permanecer abertos. O túnel gratuito gera um endereço temporário, que muda ao reiniciar.

O progresso do anfitrião permanece nos dados locais do aplicativo. **Não apague `dist/desktop/PokeSurvivor-data`**: ela pode conter seu salvamento. Para convidados, cada endereço temporário tem seu próprio armazenamento no navegador.

Instruções completas: [Jogar online](docs/JOGAR-ONLINE.md).

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
