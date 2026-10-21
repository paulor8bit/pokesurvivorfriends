# Android

APK: `dist/android/PokeSurvivor-Android.apk`. Versão de teste assinada para
instalação direta, destinada a Android 8 ou superior em celulares ARM64.
Não foi publicada na Play Store. A chave de teste não é adequada para publicação.

Transfira o APK para o celular, abra o arquivo e autorize a instalação para o
aplicativo usado para abri-lo. O jogo abre na horizontal, possui controles por
toque e funciona solo sem internet. O progresso fica nos dados privados do app;
atualizar mantendo o mesmo identificador e assinatura preserva os saves.
Desinstalar ou limpar os dados apaga o progresso. O APK não importa os saves do PC.

## Entrar como convidado usando seu progresso

Abra o seu aplicativo atualizado, entre em **Jogar**, cole o **link completo** do anfitrião e toque em **Entrar por convite**. Escolha **Minha coleção** para usar seus Pokémon e melhorias locais, ou **Coleção do anfitrião** para escolher iniciais e Pokémon emprestados com atributos base. O empréstimo vale somente para a sala. Abrir o convite em um navegador separado usa os dados daquele navegador, não os dados privados do APK.

## Ser anfitrião

Em **Jogar**, a sala abre automaticamente. Escolha **Bot** ou **Amigo convidado** para cada uma das três vagas e comece quando quiser. Amigos podem entrar durante a partida e substituir bots; a sala só fica cheia com quatro jogadores humanos. O servidor roda no celular, sem depender de um PC. Durante a partida, **Equipe e convite** no menu de pausa mostra as vagas e o link.

- **Internet:** aguarde a mensagem de convite pronto e use Compartilhar convite.
  Um túnel Cloudflare temporário fornece HTTPS sem conta ou domínio próprio.
  O endereço muda ao reabrir. Se o túnel falhar, o modo solo e o Wi-Fi continuam.
- **Mesmo Wi-Fi:** use Compartilhar Wi-Fi. Os convidados abrem o endereço local
  no navegador. A rede deve permitir comunicação entre os aparelhos; redes de
  convidados ou com isolamento podem impedir a conexão.

Mantenha o aplicativo aberto e visível no celular anfitrião durante a partida.
Compartilhar o convite não suspende as mensagens da sala. As conexões da sala
usam verificação própria de presença, sem o limite curto das requisições HTTP.
Ao sair para outro aplicativo, o Android pode suspender o jogo e desconectar
participantes. O botão Voltar oferece fechar e encerra sala, servidor e túnel.
Fechar ou forçar a parada também encerra a hospedagem. Não há serviço de início
automático nem hospedagem persistente em segundo plano.

Convites recebidos de outro anfitrião podem ser abertos diretamente no navegador
do Android. Esse navegador mantém seus próprios saves, separados do APK.

## Gerar novamente no Windows

Requer Node.js, JDK 17, Gradle 8.11.1, Android SDK plataforma 35 e build-tools
35.0.0. Configure `JAVA_HOME` e `android/local.properties` com `sdk.dir`, ou use
`ANDROID_HOME`. As ferramentas preparadas localmente em `.runtime/android-tools`
são reconhecidas pelo script. Nenhuma configuração de segurança global é alterada.

```sh
npm run build:android
```

O comando gera o jogo, copia somente recursos públicos, prepara o cloudflared
2026.10.2 verificando SHA-256, executa os testes Java e compila o APK. O processo
não executa o empacotamento Electron e não modifica os dados Windows.
Os fontes ficam em `android/app/src/main/java`, além de `dev.html` e `js/`.

`npm run test:android` executa o servidor Java real no computador e verifica
a permanência da sala com uma resposta de presença atrasada enquanto o amigo
abre o convite, a entrada de convidados, o encerramento pelo anfitrião e a
remoção de conexões que deixaram de responder. Requer as dependências já baixadas
pela compilação Android; os testes usam a porta local 8787 temporariamente.

O NanoWSD vendorizado mantém sua licença BSD e limita mensagens a 256 KiB,
inclusive mensagens fragmentadas. O servidor usa a mesma validação de membros,
limite de vagas e autorização de retransmissão do protocolo Windows. Arquivos
privados, fontes Java, dependências, logs e salvamentos não são servidos.

O túnel contém apenas o executável ARM64 nesta primeira versão. Emuladores x86
não executam esse túnel. Licenças adicionais: `android/THIRD-PARTY.md`.
