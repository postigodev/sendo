mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::test_core])
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
