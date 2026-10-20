package com.pokesurvivor.android;

import fi.iki.elonen.NanoWSD;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Only bundled public assets are served; private app files are inaccessible. */
public final class GameServer extends NanoWSD {
    public interface Assets { InputStream open(String path) throws IOException; }
    private final Assets assets;
    private final RoomHub hub = new RoomHub();
    private final Set<Peer> peers = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor();
    public volatile String publicUrl = "", localUrl = "", tunnelMessage = "Preparando o convite pela internet…";
    public GameServer(Assets assets) { super("0.0.0.0", 8787); this.assets = assets; }
    public void begin() throws IOException {
        start(15000, true);
        heartbeat.scheduleAtFixedRate(() -> { for (Peer p : peers) { try { if (!p.alive) p.close(WebSocketFrame.CloseCode.GoingAway, "Timeout", false); else { p.alive = false; p.ping(new byte[0]); } } catch (IOException e) { peers.remove(p); hub.disconnect(p.client); } } }, 15, 15, TimeUnit.SECONDS);
    }
    @Override protected boolean isWebsocketRequested(IHTTPSession s) {
        if (!super.isWebsocketRequested(s) || !"/rooms".equals(s.getUri()) || peers.size() >= 64) return false;
        String origin = s.getHeaders().get("origin"), host = s.getHeaders().get("host");
        try { return origin == null || new java.net.URI(origin).getAuthority().equals(host); }
        catch (Exception e) { return false; }
    }
    @Override protected WebSocket openWebSocket(IHTTPSession s) { return new Peer(s); }
    private final class Peer extends WebSocket {
        RoomHub.Client client; volatile boolean alive = true;
        Peer(IHTTPSession s) { super(s); }
        @Override protected void onOpen() {
            peers.add(this);
            try { client = hub.connect(raw -> { try { send(raw); } catch (IOException e) { try { close(WebSocketFrame.CloseCode.GoingAway, "Disconnected", false); } catch (IOException ignored) {} } }); }
            catch (RuntimeException e) { try { close(WebSocketFrame.CloseCode.PolicyViolation, "Full", false); } catch (IOException ignored) {} }
        }
        @Override protected void onMessage(WebSocketFrame frame) {
            if (frame.getOpCode() != WebSocketFrame.OpCode.Text || frame.getBinaryPayload().length > 262144) { try { close(WebSocketFrame.CloseCode.MessageTooBig, "Invalid", false); } catch (IOException ignored) {} return; }
            hub.receive(client, frame.getTextPayload());
        }
        @Override protected void onPong(WebSocketFrame frame) { alive = true; }
        @Override protected void onClose(WebSocketFrame.CloseCode code, String reason, boolean remote) { peers.remove(this); hub.disconnect(client); }
        @Override protected void onException(IOException e) { peers.remove(this); hub.disconnect(client); }
    }
    @Override protected Response serveHttp(IHTTPSession s) {
        if (s.getMethod() != Method.GET && s.getMethod() != Method.HEAD) return newFixedLengthResponse(Response.Status.METHOD_NOT_ALLOWED, "text/plain", "");
        String p = s.getUri();
        if (p.equals("/api/server")) {
            Response r = newFixedLengthResponse(Response.Status.OK, "application/json", RoomHub.json("online", true, "android", true, "publicUrl", publicUrl.isEmpty() ? localUrl : publicUrl, "internetUrl", publicUrl, "localUrl", localUrl, "tunnelMessage", tunnelMessage).toString());
            r.addHeader("Cache-Control", "no-store"); return r;
        }
        if (p.equals("/")) p = "/index.html";
        boolean allowed = p.matches("/(assets|css|js)/[\\w/ .@+-]+") || p.matches("/(index\\.html|sw\\.js|manifest\\.webmanifest|favicon\\.ico|version\\.json|CREDITS\\.md|LICENSE|LICENSE-NONCOMMERCIAL\\.md|ANDROID-LICENSES\\.md|LICENSE-cloudflared\\.txt|LICENSE-nanohttpd\\.txt)");
        if (!allowed || Arrays.asList(p.split("/")).contains("..")) return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "");
        try {
            InputStream in = assets.open(p.substring(1));
            Response r = newChunkedResponse(Response.Status.OK, mime(p), in);
            r.addHeader("X-Content-Type-Options", "nosniff"); r.addHeader("Referrer-Policy", "no-referrer"); r.addHeader("Cache-Control", "no-cache"); return r;
        } catch (IOException e) { return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", ""); }
    }
    private static String mime(String p) {
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".wav")) return "audio/wav";
        return "text/plain";
    }
    @Override public void stop() {
        heartbeat.shutdownNow(); hub.close();
        for (Peer p : peers) { try { p.close(WebSocketFrame.CloseCode.GoingAway, "Host closed", false); } catch (IOException ignored) {} }
        peers.clear(); super.stop();
    }
}
