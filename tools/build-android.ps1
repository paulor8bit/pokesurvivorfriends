$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$toolsDir = Join-Path $projectRoot '.runtime/android-tools'
if (-not $env:JAVA_HOME) {
    $jdkDir = Get-ChildItem (Join-Path $toolsDir 'java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdkDir) { $env:JAVA_HOME = $jdkDir.FullName }
}
if (-not $env:JAVA_HOME) { throw 'Instale JDK 17 e configure JAVA_HOME. Veja docs/ANDROID.md.' }
$env:GRADLE_USER_HOME = Join-Path $toolsDir 'gradle-home'
$env:ANDROID_USER_HOME = Join-Path $toolsDir 'android-user'
New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME | Out-Null
$tempDir = Join-Path $toolsDir 'temp'
New-Item -ItemType Directory -Force $tempDir | Out-Null
$env:TEMP = $tempDir
$env:TMP = $tempDir
$gradlePath = Join-Path $toolsDir 'gradle-8.11.1/bin/gradle.bat'
if (-not (Test-Path -LiteralPath $gradlePath)) {
    $gradlePath = (Get-Command gradle -ErrorAction Stop).Source
}
& node tools/prepare-android-tunnel.js
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar o túnel.' }
$keyPath = Join-Path $toolsDir 'debug.keystore'
if (-not (Test-Path -LiteralPath $keyPath)) {
    & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') -genkeypair -keystore $keyPath -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar assinatura de teste.' }
}
$jvmArgs = "-Xmx2048m -Dfile.encoding=UTF-8 -Djava.io.tmpdir=`"$tempDir`""
& $gradlePath "-Dorg.gradle.jvmargs=$jvmArgs" -p android testDebugUnitTest assembleDebug --console=plain --max-workers=2
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o APK.' }
$outDir = Join-Path $projectRoot 'dist/android'
New-Item -ItemType Directory -Force $outDir | Out-Null
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination (Join-Path $outDir 'PokeSurvivor-Android.apk')
Write-Host "APK pronto: $outDir/PokeSurvivor-Android.apk"
