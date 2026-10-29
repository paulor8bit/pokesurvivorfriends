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
    private static final Set<Integer> STARTERS = new HashSet<>(Arrays.asList(1,4,7,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912,54,79));
    private static JSONArray catalogOf(JSONArray input) throws JSONException {
        Map<Integer, JSONObject> entries = new LinkedHashMap<>();
        if (input != null) for (int i = 0; i < Math.min(1025, input.length()); i++) {
            JSONObject m = input.optJSONObject(i); if (m == null) continue;
            double dex = m.optDouble("dex", 0);
            if (dex == Math.floor(dex) && dex >= 1 && dex <= 1025) entries.put((int)dex, json("dex", (int)dex, "shiny", Boolean.TRUE.equals(m.opt("shiny"))));
        }
        return new JSONArray(entries.values());
    }
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
        String id, host, mode = "survival"; boolean open = true; JSONArray catalog = new JSONArray();
        JSONArray slots = new JSONArray(); JSONObject run;
        Map<String, JSONObject> members = new LinkedHashMap<>();
        JSONObject view() {
            List<JSONObject> people = new ArrayList<>(members.values()); people.sort(Comparator.comparingInt(p -> p.optInt("slot")));
            Set<Integer> occupied = new HashSet<>(); for (JSONObject p : people) occupied.add(p.optInt("slot"));
            JSONArray bots = new JSONArray();
            for (int i = 0; i < slots.length(); i++) { JSONObject s = slots.optJSONObject(i); if (s != null && s.optString("kind").equals("bot") && !occupied.contains(i + 1)) bots.put(json("kind", "bot", "slot", i + 1, "dex", s.optInt("dex"))); }
            return json("id", id, "host", host, "mode", mode, "capacity", capacityOf(mode), "open", open, "catalog", catalog, "members", new JSONArray(people), "slots", slots, "bots", bots, "run", run == null ? JSONObject.NULL : run);
        }
    }
    private static int capacityOf(String mode) { return Arrays.asList("rogue", "arena", "beatup").contains(mode) ? 2 : 4; }
    private static JSONArray slotsOf(JSONArray input, JSONArray catalog, String mode) throws Exception {
        Set<Integer> owned = new HashSet<>(), used = new HashSet<>();
        for (int i = 0; i < catalog.length(); i++) owned.add(catalog.getJSONObject(i).getInt("dex"));
        JSONArray result = new JSONArray();
        for (int i = 0; i < (mode.equals("rogue") || mode.equals("beatup") ? 1 : 3); i++) {
            JSONObject s = input == null ? null : input.optJSONObject(i);
            if (s == null || !s.optString("kind").equals("bot")) result.put(json("kind", "friend"));
            else {
                int dex = s.optInt("dex"); if (!owned.contains(dex) || !used.add(dex)) throw new Exception("Elige un Pokémon distinto de tu colección para cada bot.");
                result.put(json("kind", "bot", "dex", dex));
            }
        }
        return result;
    }
    private static int freeSlot(Room room) {
        Set<Integer> occupied = new HashSet<>(); for (JSONObject m : room.members.values()) occupied.add(m.optInt("slot"));
        int first = -1;
        for (int i = 1; i <= room.slots.length(); i++) if (!occupied.contains(i)) {
            if (first < 0) first = i;
            if (!room.slots.optJSONObject(i - 1).optString("kind").equals("bot")) return i;
        }
        return first;
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
    private JSONObject member(Client c, JSONObject input, Room room) throws Exception {
        if (input == null) throw new Exception("Elige tu Pokémon antes de entrar.");
        String name = Normalizer.normalize(input.optString("name", "").trim(), Normalizer.Form.NFC);
        if (!name.matches("[\\p{L}\\p{N}_ -]{2,20}")) throw new Exception("Usa un apodo de 2 a 20 letras o números.");
        double dex = input.optDouble("dex", 0);
        if (dex != Math.floor(dex) || dex < 1 || dex > 1025) throw new Exception("Elige tu Pokémon antes de entrar.");
        String source = input.optString("source", "local");
        if (!source.equals("host") && !source.equals("starter")) source = "local";
        JSONObject entry = null;
        if (room != null) for (int i = 0; i < room.catalog.length(); i++) {
            JSONObject m = room.catalog.getJSONObject(i); if (m.getInt("dex") == (int)dex) { entry = m; break; }
        }
        if ((source.equals("starter") && !STARTERS.contains((int)dex)) || (source.equals("host") && entry == null && !STARTERS.contains((int)dex))) throw new Exception("Ese Pokémon no está disponible en esta sala.");
        boolean shiny = Boolean.TRUE.equals(input.opt("shiny")) && !source.equals("starter") && (!source.equals("host") || (entry != null && entry.optBoolean("shiny")));
        return json("uid", c.uid, "name", name, "dex", (int)dex, "shiny", shiny, "source", source);
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
                    JSONObject info = member(c, m.optJSONObject("member"), null);
                    if (r != null) throw new Exception("Sal de tu sala antes de crear otra.");
                    if (rooms.size() >= 32) throw new Exception("Hay demasiadas salas. Inténtalo más tarde.");
                    Room next = new Room(); do { next.id = id(6); } while (rooms.containsKey(next.id));
                    next.host = c.uid; next.catalog = catalogOf(m.optJSONArray("catalog"));
                    next.mode = Arrays.asList("arena", "rogue", "beatup").contains(m.optString("mode")) ? m.optString("mode") : "survival";
                    next.slots = slotsOf(m.optJSONArray("slots"), next.catalog, next.mode);
                    info.put("slot", 0); next.members.put(c.uid, info); rooms.put(next.id, next); c.room = next.id;
                    result.put("room", next.view()); break;
                }
                case "join": {
                    Room next = rooms.get(m.optString("code").replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT));
                    if (r != null) throw new Exception("Sal de tu sala antes de entrar en otra.");
                    if (next == null) throw new Exception("Esa sala ya no existe. Pide un nuevo enlace.");
                    if (!next.open) throw new Exception("La partida de esa sala ya ha empezado.");
                    if (next.members.size() >= capacityOf(next.mode)) throw new Exception("La sala está llena.");
                    if (Arrays.asList("arena", "beatup").contains(next.mode) && next.run != null) throw new Exception("A partida já começou.");
                    JSONObject info = member(c, m.optJSONObject("member"), next);
                    info.put("slot", freeSlot(next));
                    c.room = next.id; next.members.put(c.uid, info); result.put("room", next.view()); c.emit(result); broadcast(next); return;
                }
                case "leave": leave(c); break;
                case "catalog": {
                    Room next = rooms.get(m.optString("code").replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT));
                    if (next == null) throw new Exception("Esa sala ya no existe. Pide un nuevo enlace.");
                    if (!next.open) throw new Exception("La partida de esa sala ya ha empezado.");
                    result.put("catalog", next.catalog); break;
                }
                case "member":
                    if (r == null) throw new Exception("No estás en una sala.");
                    if (!r.open || r.run != null) throw new Exception("La partida de esa sala ya ha empezado.");
                    if (r.host.equals(c.uid) && m.optJSONArray("catalog") != null) r.catalog = catalogOf(m.optJSONArray("catalog"));
                    JSONObject info = member(c, m.optJSONObject("member"), r); info.put("slot", r.members.get(c.uid).optInt("slot"));
                    r.members.put(c.uid, info); broadcast(r); break;
                case "slots": {
                    if (r == null || !r.host.equals(c.uid)) throw new Exception("Sólo el anfitrión puede cambiar los huecos.");
                    if (m.has("mode") && (r.run != null || Arrays.asList("arena", "beatup").contains(r.mode) || !Arrays.asList("survival", "rogue").contains(m.optString("mode")))) throw new Exception("O modo só pode mudar antes da partida.");
                    String mode = m.has("mode") ? m.getString("mode") : r.mode;
                    if (r.members.size() > capacityOf(mode)) throw new Exception("O Rogue permite no máximo dois Pokémon. Deixe apenas um convidado na sala.");
                    JSONArray next = slotsOf(m.optJSONArray("slots"), r.catalog, mode);
                    for (JSONObject p : r.members.values()) {
                        int slot = p.optInt("slot") - 1; if (slot < 0) continue;
                        if (mode.equals("rogue")) slot = 0;
                        JSONObject a = next.getJSONObject(slot), b = r.slots.getJSONObject(slot);
                        if (a.optString("kind").equals("bot") && (!b.optString("kind").equals("bot") || a.optInt("dex") != b.optInt("dex"))) throw new Exception("Ese hueco está ocupado por un jugador.");
                    }
                    r.slots = next; r.mode = mode;
                    if (mode.equals("rogue")) for (JSONObject p : r.members.values()) if (p.optInt("slot") > 0) p.put("slot", 1);
                    broadcast(r); break;
                }
                case "start": {
                    if (r == null || !r.host.equals(c.uid)) throw new Exception("Sólo el anfitrión puede empezar.");
                    if (r.run != null) throw new Exception("La partida ya está en marcha.");
                    double seed = m.optDouble("seed", -1); if (seed < 0 || seed > 2147483647 || seed != Math.floor(seed)) throw new Exception("Mensaje inválido.");
                    r.run = json("id", id(8), "seed", (int)seed, "mode", r.mode); r.open = !Arrays.asList("arena", "beatup").contains(r.mode); broadcast(r); result.put("room", r.view()); break;
                }
                case "finish":
                    if (r == null || !r.host.equals(c.uid)) throw new Exception("Sólo el anfitrión puede terminar.");
                    r.run = null; r.open = true; broadcast(r); break;
                case "open":
                    if (r == null || !r.host.equals(c.uid)) throw new Exception("Sólo el anfitrión puede empezar.");
                    if (Arrays.asList("arena", "beatup").contains(r.mode) && r.run != null) throw new Exception("A partida já começou.");
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
