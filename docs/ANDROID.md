# Android

APK: `dist/android/PokeSurvivor-Android.apk`. Versão de teste assinada para
instalação direta, destinada a Android 8 ou superior em celulares ARM64.
Não foi publicada na Play Store. A chave de teste não é adequada para publicação.

Transfira o APK para o celular, abra o arquivo e autorize a instalação para o
aplicativo usado para abri-lo. O jogo abre na horizontal, possui controles por
toque e funciona solo sem internet. O progresso fica nos dados privados do app;
atualizar mantendo o mesmo identificador e assinatura preserva os saves.
Desinstalar ou limpar os dados apaga o progresso. O APK não importa os saves do PC.

## Ser anfitrião

Em **Jogar com amigos**, informe o apelido e crie uma sala. Há até quatro vagas,
incluindo o anfitrião. O servidor roda no celular, sem depender de um PC.

- **Internet:** aguarde a mensagem de convite pronto e use Compartilhar convite.
  Um túnel Cloudflare temporário fornece HTTPS sem conta ou domínio próprio.
  O endereço muda ao reabrir. Se o túnel falhar, o modo solo e o Wi-Fi continuam.
- **Mesmo Wi-Fi:** use Compartilhar Wi-Fi. Os convidados abrem o endereço local
  no navegador. A rede deve permitir comunicação entre os aparelhos; redes de
  convidados ou com isolamento podem impedir a conexão.

Mantenha o aplicativo aberto e visível no celular anfitrião durante a partida.
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

O NanoWSD vendorizado mantém sua licença BSD e limita mensagens a 256 KiB,
inclusive mensagens fragmentadas. O servidor usa a mesma validação de membros,
limite de vagas e autorização de retransmissão do protocolo Windows. Arquivos
privados, fontes Java, dependências, logs e salvamentos não são servidos.

O túnel contém apenas o executável ARM64 nesta primeira versão. Emuladores x86
não executam esse túnel. Licenças adicionais: `android/THIRD-PARTY.md`.
