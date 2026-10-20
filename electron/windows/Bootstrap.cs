using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// Extract once into an immutable versioned cache. Reopening never removes
// or extracts files over a running Electron process.
internal static class Bootstrap
{
    private const string PayloadHash = "__PAYLOAD_SHA256__";
    private static string DataRoot, LogPath;
    private static bool portableData;
    private static volatile bool cancel;
    private static Process child;
    private static Form splash;
    private static Label status;

    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try {
            string portable = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location), "PokeSurvivor-data", "DesktopLauncher");
            string installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PokeSurvivor", "DesktopLauncher");
            // Preserve the existing save location across launch permission contexts.
            if (Directory.Exists(Path.Combine(Path.GetDirectoryName(portable), "Profile")) && Writable(portable)) {
                DataRoot = portable; portableData = true;
            } else if (Writable(installed)) DataRoot = installed;
            else if (Writable(portable)) { DataRoot = portable; portableData = true; }
            else throw new Exception("Mova o aplicativo para uma pasta em que você possa salvar arquivos.");
            LogPath = Path.Combine(DataRoot, "startup.log");
        } catch (Exception error) {
            MessageBox.Show(error.Message, "PokéSurvivor", MessageBoxButtons.OK, MessageBoxIcon.Error); return;
        }
        splash = new Form { Text = "PokéSurvivor", ClientSize = new Size(440, 160), StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false,
            BackColor = Color.FromArgb(16, 30, 54), ForeColor = Color.White };
        try { splash.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch { }
        splash.Controls.Add(new Label { Text = "Abrindo o PokéSurvivor…", Location = new Point(24, 22), AutoSize = true,
            Font = new Font("Segoe UI", 17, FontStyle.Bold) });
        status = new Label { Text = "Preparando o aplicativo…", Location = new Point(26, 66), Size = new Size(390, 42), Font = new Font("Segoe UI", 10) };
        splash.Controls.Add(status);
        splash.Controls.Add(new ProgressBar { Location = new Point(26, 120), Size = new Size(386, 8), Style = ProgressBarStyle.Marquee });
        splash.FormClosing += (sender, e) => {
            cancel = true;
            try { if (child != null && !child.HasExited) { child.CloseMainWindow(); if (!child.WaitForExit(1000)) child.Kill(); } } catch { }
        };
        splash.Shown += async (sender, e) => {
            try { await Task.Run(() => Run(args)); }
            catch (OperationCanceledException) { }
            catch (Exception error) {
                Log(error.ToString());
                if (!cancel) MessageBox.Show(splash, "Não foi possível abrir o jogo.\n\n" + error.Message + "\n\nDiagnóstico: " + LogPath,
                    "PokéSurvivor", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally { if (!splash.IsDisposed) splash.Close(); }
        };
        Application.Run(splash);
    }
    private static void SetStatus(string message)
    {
        if (!splash.IsDisposed) splash.BeginInvoke((Action)(() => status.Text = message));
    }
    private static void Log(string message)
    {
        try { File.AppendAllText(LogPath, DateTime.Now.ToString("s") + " " + message + Environment.NewLine); } catch { }
    }
    private static bool Writable(string directory)
    {
        try {
            Directory.CreateDirectory(directory);
            string probe = Path.Combine(directory, ".write-test-" + Guid.NewGuid().ToString("N"));
            using (File.Create(probe)) { } File.Delete(probe); return true;
        } catch { return false; }
    }
    private static string Hash(Stream input)
    {
        using (var hash = SHA256.Create()) return BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "");
    }
    private static bool Complete(string directory)
    {
        try {
            return File.ReadAllText(Path.Combine(directory, ".complete")) == PayloadHash &&
                File.Exists(Path.Combine(directory, "PokéSurvivor.exe")) &&
                File.Exists(Path.Combine(directory, "resources", "app.asar")) &&
                File.Exists(Path.Combine(directory, "resources", "tunnel", "cloudflared.exe"));
        } catch { return false; }
    }
    private static string Prepare()
    {
        string prefix = "app-" + PayloadHash.Substring(0, 16);
        string pointer = Path.Combine(DataRoot, prefix + ".path");
        string destination = Path.Combine(DataRoot, prefix);
        if (File.Exists(pointer)) {
            string cached = Path.GetFullPath(File.ReadAllText(pointer));
            if (cached.StartsWith(Path.GetFullPath(DataRoot) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && Complete(cached)) {
                Log("Using cached application " + prefix); return Path.Combine(cached, "PokéSurvivor.exe");
            }
        }
        if (Complete(destination)) {
            File.WriteAllText(pointer, destination); return Path.Combine(destination, "PokéSurvivor.exe");
        }
        if (Directory.Exists(destination)) destination += "-" + Guid.NewGuid().ToString("N");
        string staging = Path.Combine(DataRoot, ".prepare-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(staging);
        try {
            SetStatus("Preparando os arquivos pela primeira vez…");
            using (var input = Assembly.GetExecutingAssembly().GetManifestResourceStream("PokeSurvivor.Payload")) {
                if (input == null || Hash(input) != PayloadHash) throw new Exception("O pacote do jogo está incompleto. Copie novamente o executável.");
                input.Position = 0;
                using (var archive = new ZipArchive(input, ZipArchiveMode.Read)) {
                    int count = 0;
                    string root = Path.GetFullPath(staging) + Path.DirectorySeparatorChar;
                    foreach (var entry in archive.Entries) {
                        if (cancel) throw new OperationCanceledException();
                        string target = Path.GetFullPath(Path.Combine(staging, entry.FullName));
                        if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("Caminho inválido no pacote.");
                        if (entry.Name.Length == 0) Directory.CreateDirectory(target);
                        else {
                            Directory.CreateDirectory(Path.GetDirectoryName(target));
                            using (var source = entry.Open()) using (var output = File.Create(target)) source.CopyTo(output);
                        }
                        count++;
                        SetStatus("Preparando os arquivos pela primeira vez… " + (count * 100 / archive.Entries.Count) + "%");
                    }
                }
            }
            File.WriteAllText(Path.Combine(staging, ".complete"), PayloadHash);
            if (!Complete(staging)) throw new Exception("Faltam arquivos essenciais no aplicativo.");
            Directory.Move(staging, destination);
            File.WriteAllText(pointer, destination);
            Log("Prepared application " + prefix);
            return Path.Combine(destination, "PokéSurvivor.exe");
        } finally {
            // Only this launch's generated staging directory can be removed.
            if (Directory.Exists(staging) && Path.GetFullPath(staging).StartsWith(Path.GetFullPath(DataRoot) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) {
                try { Directory.Delete(staging, true); } catch { }
            }
        }
    }
    private static string Quote(string value)
    {
        var result = new StringBuilder("\""); int slashes = 0;
        foreach (char c in value) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { result.Append('\\', slashes * 2 + 1).Append(c); slashes = 0; continue; }
            result.Append('\\', slashes).Append(c); slashes = 0;
        }
        return result.Append('\\', slashes * 2).Append('"').ToString();
    }
    private static bool Ready(string marker)
    {
        try { return File.ReadAllText(marker).Contains("\"ready\":true"); } catch { return false; }
    }
    private static void Run(string[] args)
    {
        string mutexName;
        using (var input = new MemoryStream(Encoding.UTF8.GetBytes(Path.GetFullPath(DataRoot).ToLowerInvariant())))
            mutexName = "Local\\PokeSurvivor-Startup-" + Hash(input).Substring(0, 24);
        using (var gate = new Mutex(false, mutexName)) {
            bool held = false;
            try {
                SetStatus("Aguardando a preparação do aplicativo…");
                while (!held && !cancel) { try { held = gate.WaitOne(200); } catch (AbandonedMutexException) { held = true; } }
                if (cancel) return;
                string executable = Prepare();
                var arguments = new StringBuilder(); bool strict = false;
                foreach (var arg in args) { if (arg == "--strict-sandbox") strict = true; else arguments.Append(Quote(arg)).Append(" "); }
                string compatibilityFile = Path.Combine(DataRoot, "compatibility.enabled");
                bool remembered = !strict && File.Exists(compatibilityFile);
                for (int attempt = 0; attempt < 2 && !cancel; attempt++) {
                    bool compatibility = remembered || attempt == 1;
                    string marker = Path.Combine(DataRoot, ".startup-" + Guid.NewGuid().ToString("N"));
                    SetStatus(compatibility ? "Abrindo em modo de compatibilidade…" : "Iniciando o jogo…");
                    var info = new ProcessStartInfo(executable, (compatibility ? "--no-sandbox " : "") + arguments) {
                        UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetDirectoryName(executable),
                        RedirectStandardOutput = true, RedirectStandardError = true
                    };
                    info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE"); info.EnvironmentVariables.Remove("NODE_OPTIONS");
                    string temporary = Path.Combine(DataRoot, "Temp"); Directory.CreateDirectory(temporary);
                    info.EnvironmentVariables["TEMP"] = temporary; info.EnvironmentVariables["TMP"] = temporary;
                    info.EnvironmentVariables["POKESURVIVOR_STARTUP_FILE"] = marker;
                    if (portableData) {
                        string profile = Path.Combine(Path.GetDirectoryName(DataRoot), "Profile"); Directory.CreateDirectory(profile);
                        info.EnvironmentVariables["POKESURVIVOR_USER_DATA"] = profile;
                    }
                    child = new Process { StartInfo = info };
                    child.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                    child.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                    Log("Starting cached executable in " + (compatibility ? "compatibility" : "normal") + " mode");
                    child.Start(); child.BeginOutputReadLine(); child.BeginErrorReadLine();
                    bool ready = false;
                    while (!child.WaitForExit(200)) {
                        if (cancel) { try { child.CloseMainWindow(); if (!child.WaitForExit(1000)) child.Kill(); } catch { } return; }
                        if (!ready && Ready(marker)) {
                            ready = true;
                            if (compatibility) { try { File.WriteAllText(compatibilityFile, "Owner-authorized compatibility for this game only."); } catch (Exception error) { Log(error.Message); } }
                            splash.BeginInvoke((Action)(() => splash.Hide())); Log("Game ready PID " + child.Id);
                            gate.ReleaseMutex(); held = false;
                        }
                    }
                    child.WaitForExit();
                    try { File.Delete(marker); } catch { }
                    uint exit = unchecked((uint)child.ExitCode); Log("Exit " + exit.ToString("X8"));
                    if (exit == 0 || cancel) return;
                    // The owner explicitly authorized this per-game fallback.
                    if (attempt == 0 && !compatibility && !strict && !ready && exit == 0x80000003) {
                        Log("Owner-authorized per-game compatibility fallback"); continue;
                    }
                    throw new Exception("O aplicativo foi encerrado (código " + exit.ToString("X8") + ").");
                }
            } finally { if (held) gate.ReleaseMutex(); }
        }
    }
}
