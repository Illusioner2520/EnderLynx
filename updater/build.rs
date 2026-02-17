fn main() {
    if std::env::var_os("CARGO_CFG_WINDOWS").is_some() {
        windres::Build::new()
            .compile("app.rc")
            .unwrap();
    }
}