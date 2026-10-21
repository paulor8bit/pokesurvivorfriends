package com.pokesurvivor.android;

import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.net.*;
import android.view.*;
import android.webkit.*;
import java.net.*;
import java.util.*;

public final class MainActivity extends Activity {
    private WebView web; private GameServer server; private Tunnel tunnel;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(5894);
        try {
            server = new GameServer(getAssets()::open); server.localUrl = lanUrl(); server.begin();
            tunnel = new Tunnel(this, server); tunnel.start();
        } catch (Exception e) { new AlertDialog.Builder(this).setMessage("Não foi possível iniciar o jogo. Feche o aplicativo e tente novamente.").setPositiveButton("Fechar", (d,w) -> finish()).setCancelable(false).show(); return; }
        web = new WebView(this); setContentView(web);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " PokeSurvivorAndroid/1");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("http".equals(u.getScheme()) && "localhost".equals(u.getHost()) && u.getPort() == 8787) return false;
                if ("pokesurvivor".equals(u.getScheme()) && "share".equals(u.getHost())) {
                    String link = u.getQueryParameter("url");
                    if (link != null && (link.startsWith("https://") || link.startsWith("http://"))) {
                        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "Entre na minha sala de PokeSuvivor Friends! " + link);
                        startActivity(Intent.createChooser(send, "Compartilhar convite"));
                    }
                    return true;
                }
                if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) {}
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl("http://localhost:8787/");
    }
    private String lanUrl() {
        try {
            ConnectivityManager cm = (ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
            for (Network network : cm.getAllNetworks()) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                LinkProperties links = cm.getLinkProperties(network);
                if (caps == null || links == null || !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) continue;
                for (LinkAddress link : links.getLinkAddresses()) {
                    InetAddress a = link.getAddress();
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return "http://" + a.getHostAddress() + ":8787";
                }
            }
            // A phone acting as a hotspot may not expose a Wi-Fi Network.
            for (NetworkInterface n : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!n.isUp() || n.isLoopback() || !n.getName().matches("(?i)(wlan|swlan|ap)[0-9].*")) continue;
                for (InetAddress a : Collections.list(n.getInetAddresses())) if (a instanceof Inet4Address && a.isSiteLocalAddress()) return "http://" + a.getHostAddress() + ":8787";
            }
        } catch (Exception ignored) {}
        return "";
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); if (server != null) server.localUrl = lanUrl(); }
    @Override protected void onPause() {
        // Opening Android's share sheet is a temporary pause, not closing the
        // host. Keep JavaScript and room handshakes alive while sharing a link.
        if (web != null) { web.evaluateJavascript("window.dispatchEvent(new Event('blur'))", null); web.onPause(); }
        super.onPause();
    }
    @Override public void onBackPressed() {
        new AlertDialog.Builder(this).setTitle("Fechar o jogo?").setMessage("A sala e os convites serão encerrados. Seu progresso local será mantido.")
            .setNegativeButton("Continuar", null).setPositiveButton("Fechar", (d,w) -> finish()).show();
    }
    @Override protected void onDestroy() {
        if (tunnel != null) tunnel.close();
        if (server != null) server.stop();
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
