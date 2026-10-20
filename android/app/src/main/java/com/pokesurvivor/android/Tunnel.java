package com.pokesurvivor.android;

import android.content.Context;
import android.net.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.regex.*;
import java.util.concurrent.*;
import javax.net.ssl.*;
import java.security.KeyStore;
import java.security.cert.X509Certificate;

/** One temporary tunnel per visible app session; no credentials or accounts. */
public final class Tunnel implements AutoCloseable {
    private final Context context; private final GameServer server;
    private volatile boolean closed;
    private Process process; private Thread worker;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    public Tunnel(Context context, GameServer server) { this.context = context; this.server = server; }
    public void start() {
        worker = new Thread(() -> {
            try {
                File dns = new File(context.getCacheDir(), "tunnel-dns.conf");
                ConnectivityManager cm = (ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
                LinkProperties lp = cm.getLinkProperties(cm.getActiveNetwork());
                StringBuilder config = new StringBuilder();
                if (lp != null) for (InetAddress ip : lp.getDnsServers()) config.append("nameserver ").append(ip.getHostAddress()).append('\n');
                if (config.length() == 0) config.append("nameserver 1.1.1.1\nnameserver 8.8.8.8\n");
                Files.write(dns.toPath(), config.toString().getBytes(StandardCharsets.UTF_8));
                // The Linux executable needs an explicit Android trust bundle.
                TrustManagerFactory trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                trust.init((KeyStore)null);
                StringBuilder certificates = new StringBuilder();
                for (TrustManager tm : trust.getTrustManagers()) if (tm instanceof X509TrustManager) {
                    for (X509Certificate certificate : ((X509TrustManager)tm).getAcceptedIssuers()) {
                        certificates.append("-----BEGIN CERTIFICATE-----\n")
                            .append(Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(certificate.getEncoded()))
                            .append("\n-----END CERTIFICATE-----\n");
                    }
                }
                File ca = new File(context.getCacheDir(), "tunnel-ca.pem");
                Files.write(ca.toPath(), certificates.toString().getBytes(StandardCharsets.US_ASCII));
                String binary = new File(context.getApplicationInfo().nativeLibraryDir, "libcloudflared.so").getAbsolutePath();
                synchronized (this) {
                    if (closed) return;
                    ProcessBuilder builder = new ProcessBuilder(binary, "tunnel", "--no-autoupdate", "--protocol", "http2", "--url", "http://127.0.0.1:8787")
                        .directory(context.getCacheDir()).redirectInput(dns).redirectErrorStream(true);
                    builder.environment().put("SSL_CERT_FILE", ca.getAbsolutePath());
                    process = builder.start();
                }
                ScheduledFuture<?> timeout = timer.schedule(() -> {
                    synchronized (this) { if (!closed && server.publicUrl.isEmpty() && process != null) process.destroy(); }
                }, 90, TimeUnit.SECONDS);
                Pattern url = Pattern.compile("https://[a-z0-9-]+\\.trycloudflare\\.com");
                String pending = "";
                try (BufferedReader in = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while (!closed && (line = in.readLine()) != null) {
                        Matcher m = url.matcher(line); if (m.find()) pending = m.group();
                        if (line.contains("Registered tunnel connection") && !pending.isEmpty()) { timeout.cancel(false); server.publicUrl = pending; server.tunnelMessage = "Convite pela internet disponível."; }
                        if (line.contains("Unregistered tunnel connection")) { server.publicUrl = ""; server.tunnelMessage = "Reconectando o convite pela internet…"; }
                    }
                }
            } catch (Exception e) { /* User-facing state below; never publish native logs. */ }
            finally { server.publicUrl = ""; if (!closed) server.tunnelMessage = "Internet indisponível. Use o convite Wi-Fi ou reabra o aplicativo para tentar novamente."; }
        }, "pokesurvivor-tunnel"); worker.start();
    }
    @Override public synchronized void close() {
        closed = true; server.publicUrl = "";
        timer.shutdownNow();
        if (process != null) { process.destroy(); process.destroyForcibly(); process = null; }
        if (worker != null) worker.interrupt();
    }
}
