package com.pokesurvivor.android;

import org.junit.Test;
import org.json.*;
import java.util.*;
import static org.junit.Assert.*;

public class RoomHubTest {
    private final RoomHub hub = new RoomHub();
    private class Player {
        final List<JSONObject> messages = new ArrayList<>();
        final RoomHub.Client client = hub.connect(s -> {
            try { messages.add(new JSONObject(s)); } catch (JSONException e) { throw new AssertionError(e); }
        });
        JSONObject rpc(String k, Object... args) throws Exception {
            JSONObject m = RoomHub.json(args); m.put("k", k); m.put("id", 1); messages.clear(); hub.receive(client, m.toString());
            return messages.stream().filter(j -> j.optString("k").equals("result")).findFirst().orElseThrow();
        }
    }
    private JSONObject mon() { return RoomHub.json("name", "Amigo", "dex", 25); }
    @Test public void capacityHostRightsAndClosure() throws Exception {
        Player host = new Player(); JSONObject created = host.rpc("create", "member", mon());
        assertTrue(created.getBoolean("ok")); String id = created.getJSONObject("room").getString("id"); assertTrue(id.matches("[A-F0-9]{12}"));
        Player guest = new Player(); assertTrue(guest.rpc("join", "member", mon(), "code", id).getBoolean("ok"));
        assertFalse(guest.rpc("open", "open", false).getBoolean("ok"));
        for (int i = 0; i < 2; i++) assertTrue(new Player().rpc("join", "member", mon(), "code", id).getBoolean("ok"));
        assertFalse(new Player().rpc("join", "member", mon(), "code", id).getBoolean("ok"));
        host.rpc("open", "open", false);
        assertFalse(new Player().rpc("join", "member", mon(), "code", id).getBoolean("ok"));
        guest.messages.clear(); hub.disconnect(host.client);
        assertTrue(guest.messages.stream().anyMatch(m -> m.optString("k").equals("room-closed")));
    }
    @Test public void relayCannotSpoofOrCrossRooms() throws Exception {
        Player host = new Player(), a = new Player(), b = new Player(), outside = new Player();
        String id = host.rpc("create", "member", mon()).getJSONObject("room").getString("id");
        a.rpc("join", "code", id, "member", mon()); b.rpc("join", "code", id, "member", mon());
        assertFalse(a.rpc("peer", "to", b.client.uid, "payload", mon()).getBoolean("ok"));
        assertFalse(outside.rpc("peer", "to", host.client.uid, "payload", mon()).getBoolean("ok"));
        host.messages.clear();
        hub.receive(a.client, RoomHub.json("k", "peer", "to", host.client.uid, "from", outside.client.uid, "payload", mon()).toString());
        assertEquals(a.client.uid, host.messages.get(0).getString("from"));
    }
    @Test public void validationAndTeardown() throws Exception {
        Player host = new Player();
        assertFalse(host.rpc("create", "member", RoomHub.json("name", "<script>", "dex", 25)).getBoolean("ok"));
        assertFalse(host.rpc("create", "member", RoomHub.json("name", "Host", "dex", 2.5)).getBoolean("ok"));
        String id = host.rpc("create", "member", mon()).getJSONObject("room").getString("id");
        hub.close(); assertFalse(new Player().rpc("join", "member", mon(), "code", id).getBoolean("ok"));
    }
    @Test public void sharedCollectionAndBorrowing() throws Exception {
        Player host = new Player(), guest = new Player();
        JSONArray catalog = new JSONArray().put(RoomHub.json("dex", 150, "shiny", true, "coins", 900));
        JSONObject created = host.rpc("create", "member", mon(), "catalog", catalog).getJSONObject("room");
        String id = created.getString("id");
        assertFalse(created.getJSONArray("catalog").getJSONObject(0).has("coins"));
        assertTrue(guest.rpc("catalog", "code", id).getBoolean("ok"));
        assertFalse(guest.rpc("join", "code", id, "member", RoomHub.json("name", "Guest", "dex", 151, "source", "host")).getBoolean("ok"));
        assertTrue(guest.rpc("join", "code", id, "member", RoomHub.json("name", "Guest", "dex", 150, "source", "host", "shiny", true)).getBoolean("ok"));
        host.rpc("open", "open", false);
        assertFalse(guest.rpc("member", "member", mon()).getBoolean("ok"));
    }
    @Test public void livePlayersReplaceBotsAndOnlyFourHumansFillRoom() throws Exception {
        Player host = new Player();
        JSONArray catalog = new JSONArray(), slots = new JSONArray();
        for (int dex : new int[]{1,4,7}) { catalog.put(RoomHub.json("dex", dex)); slots.put(RoomHub.json("kind", "bot", "dex", dex)); }
        JSONObject room = host.rpc("create", "member", mon(), "catalog", catalog, "slots", slots).getJSONObject("room");
        String id = room.getString("id"); assertEquals(3, room.getJSONArray("bots").length());
        assertTrue(host.rpc("start", "seed", 123).getBoolean("ok"));
        Player[] guests = {new Player(), new Player(), new Player(), new Player()};
        for (int i = 0; i < 3; i++) {
            JSONObject joined = guests[i].rpc("join", "code", id, "member", mon()); assertTrue(joined.getBoolean("ok"));
            assertEquals(2 - i, joined.getJSONObject("room").getJSONArray("bots").length());
        }
        assertFalse(guests[3].rpc("join", "code", id, "member", mon()).getBoolean("ok"));
        guests[1].rpc("leave");
        assertTrue(guests[3].rpc("join", "code", id, "member", mon()).getBoolean("ok"));
        assertTrue(host.rpc("finish").getBoolean("ok"));
    }
    @Test public void rogueModeAndHostRights() throws Exception {
        Player host = new Player(), guest = new Player(), extra = new Player();
        JSONArray catalog = new JSONArray(), slots = new JSONArray();
        for (int dex : new int[]{1,4,7}) { catalog.put(RoomHub.json("dex", dex)); slots.put(RoomHub.json("kind", "bot", "dex", dex)); }
        JSONObject room = host.rpc("create", "member", mon(), "mode", "rogue", "catalog", catalog, "slots", slots).getJSONObject("room");
        assertEquals("rogue", room.getString("mode"));
        assertEquals(2, room.getInt("capacity")); assertEquals(1, room.getJSONArray("slots").length()); assertEquals(1, room.getJSONArray("bots").length());
        assertEquals(0, guest.rpc("join", "code", room.getString("id"), "member", mon()).getJSONObject("room").getJSONArray("bots").length());
        assertFalse(extra.rpc("join", "code", room.getString("id"), "member", mon()).getBoolean("ok"));
        assertFalse(guest.rpc("slots", "slots", new JSONArray(), "mode", "survival").getBoolean("ok"));
        assertTrue(host.rpc("slots", "slots", new JSONArray(), "mode", "survival").getBoolean("ok"));
        assertTrue(extra.rpc("join", "code", room.getString("id"), "member", mon()).getBoolean("ok"));
        assertFalse(host.rpc("slots", "slots", new JSONArray(), "mode", "rogue").getBoolean("ok"));
        assertEquals("survival", host.rpc("start", "seed", 7).getJSONObject("room").getString("mode"));
        host.rpc("finish"); extra.rpc("leave");
        host.rpc("slots", "slots", new JSONArray(), "mode", "rogue");
        assertEquals("rogue", host.rpc("start", "seed", 7).getJSONObject("room").getJSONObject("run").getString("mode"));
        assertFalse(host.rpc("slots", "slots", new JSONArray(), "mode", "survival").getBoolean("ok"));
        assertFalse(extra.rpc("join", "code", room.getString("id"), "member", mon()).getBoolean("ok"));
        guest.rpc("leave"); assertTrue(extra.rpc("join", "code", room.getString("id"), "member", mon()).getBoolean("ok"));
    }

    @Test public void rogueRemapsPartnerSlot() throws Exception {
        Player host = new Player(), guest = new Player();
        JSONArray catalog = new JSONArray().put(RoomHub.json("dex", 1));
        JSONArray slots = new JSONArray().put(RoomHub.json("kind", "bot", "dex", 1)).put(RoomHub.json("kind", "friend"));
        JSONObject room = host.rpc("create", "member", mon(), "catalog", catalog, "slots", slots).getJSONObject("room");
        JSONObject joined = guest.rpc("join", "code", room.getString("id"), "member", mon()).getJSONObject("room");
        assertEquals(2, joined.getJSONArray("members").getJSONObject(1).getInt("slot"));
        assertTrue(host.rpc("slots", "slots", slots, "mode", "rogue").getBoolean("ok"));
        JSONObject started = host.rpc("start", "seed", 1).getJSONObject("room");
        assertEquals(1, started.getJSONArray("members").getJSONObject(1).getInt("slot"));
        assertEquals(0, started.getJSONArray("bots").length());
    }
}
