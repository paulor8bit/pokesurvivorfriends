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
}
