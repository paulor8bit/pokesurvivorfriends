import com.pokesurvivor.android.GameServer;
import java.nio.file.*;

/** Runs the actual APK HTTP/WebSocket server on the development JVM. */
public class AndroidServerProbe {
    public static void main(String[] args) throws Exception {
        Path root = Paths.get(args[0]).toAbsolutePath();
        GameServer server = new GameServer(p -> Files.newInputStream(root.resolve(p)));
        server.localUrl = "http://127.0.0.1:8787";
        server.tunnelMessage = "Teste local";
        server.begin();
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
        System.out.println("ANDROID_SERVER_READY");
        Thread.currentThread().join();
    }
}
