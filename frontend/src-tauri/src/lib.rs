use std::{
    fs::{self, OpenOptions},
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use tauri::{path::BaseDirectory, Manager, WindowEvent};

const BACKEND_PORT: u16 = 18191;
const BACKEND_JAR: &str = "backend/juro-backend.jar";

struct BackendProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            start_backend(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed) {
                stop_backend(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running JURO");
}

fn start_backend(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if is_backend_port_open() {
        return Ok(());
    }

    let jar_path = backend_jar_path(app)?;
    let data_dir = app.path().app_data_dir()?.join("backend");
    let temp_dir = data_dir.join("tmp");
    let log_dir = app.path().app_log_dir()?;
    fs::create_dir_all(&data_dir)?;
    fs::create_dir_all(&temp_dir)?;
    fs::create_dir_all(&log_dir)?;

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("juro-backend.log"))?;
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("juro-backend-error.log"))?;

    let child = Command::new(java_executable())
        .arg(format!("-Djava.io.tmpdir={}", temp_dir.display()))
        .arg("-jar")
        .arg(jar_path)
        .env("PATH", desktop_path())
        .env("SPRING_PROFILES_ACTIVE", "desktop")
        .env("SERVER_PORT", BACKEND_PORT.to_string())
        .env("JURO_DATA_DIR", &data_dir)
        .env(
            "APP_CORS_ALLOWED_ORIGIN_PATTERNS",
            "http://localhost:*,http://127.0.0.1:*,http://tauri.localhost,https://tauri.localhost,tauri://localhost",
        )
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|error| {
            format!(
                "Unable to start JURO backend. Confirm Java 17+ is installed and available on PATH. {error}"
            )
        })?;

    let state = app.state::<BackendProcess>();
    *state.0.lock().expect("backend process lock poisoned") = Some(child);

    wait_for_backend()?;

    Ok(())
}

fn stop_backend(app: &tauri::AppHandle) {
    let state = app.state::<BackendProcess>();
    let mut process = state.0.lock().expect("backend process lock poisoned");
    if let Some(mut child) = process.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn is_backend_port_open() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], BACKEND_PORT));
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn wait_for_backend() -> Result<(), Box<dyn std::error::Error>> {
    for _ in 0..60 {
        if is_backend_port_open() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(250));
    }

    Err("JURO backend did not become ready on port 18191 within 15 seconds.".into())
}

fn backend_jar_path(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Ok(resource_path) = app.path().resolve(BACKEND_JAR, BaseDirectory::Resource) {
        if resource_path.is_file() {
            return Ok(resource_path);
        }
    }

    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../backend/target/juro-backend-0.0.1-SNAPSHOT.jar")
        .canonicalize()?;

    Ok(dev_path)
}

fn java_executable() -> PathBuf {
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let candidate = PathBuf::from(java_home).join("bin/java");
        if candidate.is_file() {
            return candidate;
        }
    }

    #[cfg(target_os = "macos")]
    if let Ok(output) = Command::new("/usr/libexec/java_home")
        .arg("-v")
        .arg("17+")
        .output()
    {
        if output.status.success() {
            let java_home = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let candidate = PathBuf::from(java_home).join("bin/java");
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    for candidate in [
        "/opt/homebrew/opt/openjdk@17/bin/java",
        "/opt/homebrew/opt/openjdk/bin/java",
        "/opt/homebrew/bin/java",
        "/usr/local/opt/openjdk@17/bin/java",
        "/usr/local/opt/openjdk/bin/java",
        "/usr/local/bin/java",
        "/usr/bin/java",
    ] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return path;
        }
    }

    PathBuf::from("java")
}

fn desktop_path() -> String {
    let mut paths = vec![
        "/opt/homebrew/opt/openjdk@17/bin",
        "/opt/homebrew/opt/openjdk/bin",
        "/opt/homebrew/bin",
        "/usr/local/opt/openjdk@17/bin",
        "/usr/local/opt/openjdk/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]
    .into_iter()
    .map(String::from)
    .collect::<Vec<_>>();

    if let Ok(current_path) = std::env::var("PATH") {
        paths.push(current_path);
    }

    paths.join(":")
}
