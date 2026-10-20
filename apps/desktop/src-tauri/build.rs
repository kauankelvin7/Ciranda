use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    if env::var("CARGO_CFG_TARGET_OS").expect("Cargo sets the target OS") == "windows" {
        let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo sets OUT_DIR"));
        let icon_path = out_dir.join("ciranda-generated.ico");
        fs::write(&icon_path, windows_icon()).expect("failed to write generated Windows icon");

        let attributes = tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new().window_icon_path(&icon_path));
        tauri_build::try_build(attributes).expect("failed to run tauri-build");
    } else {
        tauri_build::build();
    }
}

fn windows_icon() -> Vec<u8> {
    const SIDE: usize = 32;
    const XOR_BITMAP_BYTES: usize = SIDE * SIDE * 4;
    const AND_MASK_BYTES: usize = SIDE * 4;
    const DIB_BYTES: usize = 40 + XOR_BITMAP_BYTES + AND_MASK_BYTES;

    let mut icon = Vec::with_capacity(22 + DIB_BYTES);
    icon.extend_from_slice(&[0, 0, 1, 0, 1, 0]);

    // One 32x32, 32-bit uncompressed DIB image follows the ICO directory.
    icon.extend_from_slice(&[SIDE as u8, SIDE as u8, 0, 0]);
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&32_u16.to_le_bytes());
    icon.extend_from_slice(&(DIB_BYTES as u32).to_le_bytes());
    icon.extend_from_slice(&22_u32.to_le_bytes());

    icon.extend_from_slice(&40_u32.to_le_bytes());
    icon.extend_from_slice(&(SIDE as i32).to_le_bytes());
    icon.extend_from_slice(&((SIDE * 2) as i32).to_le_bytes());
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&32_u16.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());
    icon.extend_from_slice(&((XOR_BITMAP_BYTES + AND_MASK_BYTES) as u32).to_le_bytes());
    icon.extend_from_slice(&0_i32.to_le_bytes());
    icon.extend_from_slice(&0_i32.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());

    for y in (0..SIDE).rev() {
        for x in 0..SIDE {
            let (red, green, blue) = icon_pixel(x, y);
            icon.extend_from_slice(&[blue, green, red, 255]);
        }
    }

    // An all-zero AND mask marks every pixel as opaque; alpha is in the XOR data.
    icon.resize(22 + DIB_BYTES, 0);
    icon
}

fn icon_pixel(x: usize, y: usize) -> (u8, u8, u8) {
    let dx_left = x as i32 - 11;
    let dx_right = x as i32 - 21;
    let dy = y as i32 - 16;
    let left_distance = dx_left * dx_left + dy * dy;
    let right_distance = dx_right * dx_right + dy * dy;
    let left_ring = (25..=81).contains(&left_distance);
    let right_ring = (25..=81).contains(&right_distance);

    match (left_ring, right_ring) {
        (true, true) => (238, 222, 190),
        (true, false) => (243, 166, 78),
        (false, true) => (83, 202, 190),
        (false, false) => (28, 39, 61),
    }
}
