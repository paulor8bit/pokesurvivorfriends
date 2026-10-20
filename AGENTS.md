# Desenvolvimento deste fork

- Autoria do fork: **Paulinho Ricardo — gatinho.punkeca**.
- Base original: JPTER78/pokesurvivor. Preserve LICENSE, LICENSE-NONCOMMERCIAL.md, CREDITS.md e os avisos das fontes e sprites.
- Prioridade: aplicativo Electron Windows, jogo solo e cooperativo por convite, sem contas. Não reintroduza Firebase, domínio fixo, publicidade ou cobranças sem solicitação do responsável.
- Edite `dev.html` e os módulos de `js/`. `index.html`, `js/app.min.js` e `version.json` são gerados com `npm run build:game`.
- `npm run build` gera primeiro o jogo, prepara o túnel e monta o executável. Aguarde o build terminar antes de editar fontes para evitar arquivos inconsistentes no pacote.
- O iniciador prepara os arquivos uma única vez por versão. Não extraia arquivos por cima de uma instância em execução. Preserve a reabertura e o foco da janela existente.
- A compatibilidade autorizada pelo responsável pertence somente ao jogo; não altere configurações globais de segurança do Windows.
- Preserve `ps.save.*`, migrações dos saves e o endereço local estável. Não apague `dist/desktop/PokeSurvivor-data`, perfis do aplicativo ou dados do navegador durante limpezas.
- Não publique pastas privadas, fontes do servidor, dependências ou logs pelo servidor de convidados. Licenças e créditos públicos têm permissão explícita.
- Salas ficam na memória do anfitrião; fechar o aplicativo deve encerrar a sala, o servidor e o túnel.
- Execute `npm test` nas mudanças de persistência, salas ou inicialização. Verifique o carregamento do jogo no navegador após remover módulos ou telas. Para mudanças no iniciador, teste fechar, reabrir e abrir com o jogo já em execução.
- Atualize as novidades ao mudar comportamento do jogo. Alterações de documentação e ferramentas não precisam aparecer no jogo.
- Não faça commit, push ou publicação sem solicitação do responsável.
