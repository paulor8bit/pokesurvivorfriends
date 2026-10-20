package com.pokesurvivor.android;

import org.json.*;
import java.text.Normalizer;
import java.security.SecureRandom;
import java.util.*;
import java.util.function.Consumer;

/** In-memory room protocol shared with the Windows host. No disk persistence. */
public final class RoomHub {
    private final Map<String, Client> clients = new LinkedHashMap<>();
    private final Map<String, Room> rooms = new HashMap<>();
    private final SecureRandom random = new SecureRandom();
    public static JSONObject json(Object... pairs) {
        JSONObject j = new JSONObject();
        try { for (int i = 0; i < pairs.length; i += 2) j.put((String)pairs[i], pairs[i + 1]); }
        catch (JSONException e) { throw new IllegalArgumentException(e); }
        return j;
    }
    private String id(int bytes) {
        byte[] data = new byte[bytes]; random.nextBytes(data);
        StringBuilder s = new StringBuilder(); for (byte b : data) s.append(String.format(Locale.ROOT, "%02X", b)); return s.toString();
    }
    public final class Client {
        public final String uid = id(12);
        String room;
        long since = System.currentTimeMillis(); int count;
        final Consumer<String> send;
        Client(Consumer<String> send) { this.send = send; }
        void emit(JSONObject value) { send.accept(value.toString()); }
    }
    private static final class Room {
        String id, host; boolean open = true;
        Map<String, JSONObject> members = new LinkedHashMap<>();
        JSONObject view() { return json("id", id, "host", host, "open", open, "members", new JSONArray(members.values())); }
    }
    public synchronized Client connect(Consumer<String> send) {
        if (clients.size() >= 64) throw new IllegalStateException("Servidor cheio.");
        Client c = new Client(send); clients.put(c.uid, c); c.emit(json("k", "hello", "uid", c.uid)); return c;
    }
    private void broadcast(Room room) {
        for (String uid : room.members.keySet()) { Client c = clients.get(uid); if (c != null) c.emit(json("k", "room", "room", room.view())); }
    }
    private void leave(Client c) {
        Room r = rooms.get(c.room); c.room = null; if (r == null) return;
        if (r.host.equals(c.uid)) {
            rooms.remove(r.id);
            for (String uid : r.members.keySet()) { Client other = clients.get(uid); if (other != null) { other.room = null; other.emit(json("k", "room-closed")); } }
        } else { r.members.remove(c.uid); broadcast(r); }
    }
    public synchronized void disconnect(Client c) { if (c != null) { leave(c); clients.remove(c.uid); } }
    public synchronized void close() { for (Client c : new ArrayList<>(clients.values())) disconnect(c); rooms.clear(); }
    private JSONObject member(Client c, JSONObject input) throws Exception {
        if (input == null) throw new Exception("Elige tu Pokémon antes de entrar.");
        String name = Normalizer.normalize(input.optString("name", "").trim(), Normalizer.Form.NFC);
        if (!name.matches("[\\p{L}\\p{N}_ -]{2,20}")) throw new Exception("Usa un apodo de 2 a 20 letras o números.");
        double dex = input.optDouble("dex", 0);
        if (dex != Math.floor(dex) || dex < 1 || dex > 1025) throw new Exception("Elige tu Pokémon antes de entrar.");
        return json("uid", c.uid, "name", name, "dex", (int)dex, "shiny", Boolean.TRUE.equals(input.opt("shiny")));
    }
    public synchronized void receive(Client c, String raw) {
        JSONObject m = null;
        try {
            if (!clients.containsKey(c.uid) || raw.length() > 256 * 1024) throw new Exception("Mensaje inválido.");
            if (System.currentTimeMillis() - c.since > 1000) { c.since = System.currentTimeMillis(); c.count = 0; }
            if (++c.count > 200) { disconnect(c); return; }
            m = new JSONObject(raw); Room r = rooms.get(c.room); JSONObject result = json("k", "result", "id", m.opt("id"), "ok", true);
            switch (m.optString("k")) {
                case "create": {
                    JSONObject info = member(c, m.optJSONObject("member"));
                    if (r != null) throw new Exception("Sal de tu sala antes de crear otra.");
                    if (rooms.size() >= 32) throw new Exception("Hay demasiadas salas. Inténtalo más tarde.");
                    Room next = new Room(); do { next.id = id(6); } while (rooms.containsKey(next.id));
                    next.host = c.uid; next.members.put(c.uid, info); rooms.put(next.id, next); c.room = next.id;
                    result.put("room", next.view()); break;
                }
                case "join": {
                    JSONObject info = member(c, m.optJSONObject("member"));
                    Room next = rooms.get(m.optString("code").replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT));
                    if (r != null) throw new Exception("Sal de tu sala antes de entrar en otra.");
                    if (next == null) throw new Exception("Esa sala ya no existe. Pide un nuevo enlace.");
                    if (!next.open) throw new Exception("La partida de esa sala ya ha empezado.");
                    if (next.members.size() >= 4) throw new Exception("La sala está llena (máximo 4).");
                    c.room = next.id; next.members.put(c.uid, info); result.put("room", next.view()); c.emit(result); broadcast(next); return;
                }
                case "leave": leave(c); break;
                case "member":
                    if (r == null) throw new Exception("No estás en una sala.");
                    r.members.put(c.uid, member(c, m.optJSONObject("member"))); broadcast(r); break;
                case "open":
                    if (r == null || !r.host.equals(c.uid)) throw new Exception("Sólo el anfitrión puede empezar.");
                    r.open = Boolean.TRUE.equals(m.opt("open")); broadcast(r); break;
                case "peer": {
                    Client target = clients.get(m.optString("to"));
                    if (r == null || target == null || !r.id.equals(target.room) || target == c || (!r.host.equals(c.uid) && !r.host.equals(target.uid))) throw new Exception("Conexión inválida.");
                    JSONObject payload = m.optJSONObject("payload"); if (payload == null) throw new Exception("Mensaje inválido.");
                    target.emit(json("k", "peer", "from", c.uid, "payload", payload)); return;
                }
                default: throw new Exception("Mensaje inválido.");
            }
            c.emit(result);
        } catch (Exception e) { c.emit(json("k", "result", "id", m == null ? null : m.opt("id"), "ok", false, "error", e.getMessage())); }
    }
}
