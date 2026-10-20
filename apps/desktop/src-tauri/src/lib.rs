#[tauri::command]
fn greet(name: &str) -> String {
    format!("Olá, {name}! O núcleo Rust está ativo.")
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo CIRANDA");
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn greet_returns_the_requested_name() {
        assert_eq!(greet("CIRANDA"), "Olá, CIRANDA! O núcleo Rust está ativo.");
    }
}
