use std::fs;
use std::path::{Component, Path, PathBuf};

const MAX_CWD_BYTES: usize = 4096;

pub(crate) fn workspace_root() -> Result<PathBuf, String> {
    let configured = std::env::var_os("CIRANDA_WORKSPACE_ROOT");
    let fallback = std::env::current_dir().map_err(|_| "workspace root is unavailable")?;
    resolve_workspace_root(configured.as_deref(), &fallback)
}

fn resolve_workspace_root(
    configured: Option<&std::ffi::OsStr>,
    fallback: &Path,
) -> Result<PathBuf, String> {
    let requested = configured
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| fallback.to_path_buf());

    if requested.as_os_str().is_empty() || is_unc_or_device_path(&requested) {
        return Err("workspace root must be a local filesystem path".into());
    }
    if !requested.is_absolute() {
        return Err("workspace root must be absolute".into());
    }
    for component in requested.components() {
        if let Component::Normal(name) = component {
            let name = name
                .to_str()
                .ok_or("workspace root contains a non-Unicode path component")?;
            validate_windows_component(name)?;
        }
    }

    reject_reparse_components(&requested)?;
    let canonical = fs::canonicalize(&requested).map_err(|_| "workspace root is unavailable")?;
    if !canonical.is_dir() {
        return Err("workspace root must be a directory".into());
    }
    reject_reparse_components(&canonical)?;
    Ok(canonical)
}

pub(crate) fn resolve_cwd(root: &Path, cwd: Option<&str>) -> Result<PathBuf, String> {
    let raw = cwd.unwrap_or(".");
    if raw.len() > MAX_CWD_BYTES {
        return Err("working directory path is too long".into());
    }
    if raw.is_empty() || raw.starts_with('/') || raw.starts_with('\\') || is_unc_or_device_text(raw)
    {
        return Err("working directory must be relative to the workspace".into());
    }
    if raw == "." {
        return Ok(root.to_path_buf());
    }

    let relative = Path::new(raw);
    if relative.is_absolute() {
        return Err("working directory must be relative to the workspace".into());
    }

    let mut candidate = root.to_path_buf();
    let mut saw_component = false;
    for part in raw.split(|ch| ch == '/' || ch == '\\') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err("working directory cannot escape the workspace".into());
        }
        validate_windows_component(part)?;
        candidate.push(part);
        saw_component = true;
    }
    if !saw_component {
        return Err("working directory is invalid".into());
    }

    reject_reparse_components(&candidate)?;
    let canonical = fs::canonicalize(&candidate).map_err(|_| "working directory is unavailable")?;
    if !canonical.starts_with(root) {
        return Err("working directory cannot escape the workspace".into());
    }
    if !canonical.is_dir() {
        return Err("working directory must be a directory".into());
    }
    reject_reparse_components(&canonical)?;
    Ok(canonical)
}

pub(crate) fn ensure_directory_without_reparse(path: &Path) -> Result<(), String> {
    reject_reparse_components(path)?;
    match fs::create_dir(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(_) => return Err("workspace state directory cannot be created".into()),
    }
    reject_reparse_components(path)?;
    let metadata =
        fs::symlink_metadata(path).map_err(|_| "workspace state directory is unavailable")?;
    if !metadata.is_dir() {
        return Err("workspace state path is not a directory".into());
    }
    Ok(())
}

pub(crate) fn reject_reparse_components(path: &Path) -> Result<(), String> {
    let mut current = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => current.push(prefix.as_os_str()),
            Component::RootDir => current.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("path traversal is not allowed".into());
            }
            Component::Normal(name) => current.push(name),
        }
        // A Windows drive prefix such as `C:` is not an inspectable path until
        // its root separator has been added. Continue checking each component
        // once the path is absolute, including canonical `\\?\` paths.
        if !current.is_absolute() {
            continue;
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || is_windows_reparse_point(&current) {
                    return Err(
                        "symbolic links and junctions are not allowed in workspace paths".into(),
                    );
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("workspace path cannot be inspected".into()),
        }
    }
    Ok(())
}

pub(crate) fn reject_hard_linked_file(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err("workspace database cannot be inspected".into()),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("workspace database path is not a regular file".into());
    }

    #[cfg(windows)]
    {
        reject_windows_hard_linked_file(path)
    }

    #[cfg(unix)]
    {
        if hard_link_count(&metadata) > 1 {
            return Err("workspace database cannot be a hard link".into());
        }
        Ok(())
    }

    #[cfg(not(any(windows, unix)))]
    {
        Ok(())
    }
}

#[cfg(windows)]
fn reject_windows_hard_linked_file(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
        FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    struct OwnedHandle(HANDLE);

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            // SAFETY: this wrapper owns the valid handle returned by CreateFileW.
            unsafe { CloseHandle(self.0) };
        }
    }

    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    // SAFETY: `wide` is null-terminated and all other pointers/flags satisfy the API contract.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_OPEN_REPARSE_POINT,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE || handle.is_null() {
        return Err("workspace database cannot be inspected".into());
    }
    let handle = OwnedHandle(handle);

    // SAFETY: the zeroed Win32 output structure is writable for the duration of the call.
    let mut information: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    // SAFETY: `handle` is a live file handle and `information` is a writable output buffer.
    if unsafe { GetFileInformationByHandle(handle.0, &mut information) } == 0 {
        return Err("workspace database cannot be inspected".into());
    }
    if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err("workspace database cannot be a reparse point".into());
    }
    if information.nNumberOfLinks > 1 {
        return Err("workspace database cannot be a hard link".into());
    }
    Ok(())
}

#[cfg(unix)]
fn hard_link_count(metadata: &fs::Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    metadata.nlink()
}

fn validate_windows_component(component: &str) -> Result<(), String> {
    if component.is_empty()
        || component.ends_with(' ')
        || component.ends_with('.')
        || component
            .chars()
            .any(|ch| ch.is_control() || "<>:\"|?*".contains(ch))
    {
        return Err("working directory contains an invalid Windows path component".into());
    }

    let base = component
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    let reserved = matches!(
        base.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "CONIN$"
            | "CONOUT$"
            | "COM¹"
            | "COM²"
            | "COM³"
            | "LPT¹"
            | "LPT²"
            | "LPT³"
    ) || (base.len() == 4
        && (base.starts_with("COM") || base.starts_with("LPT"))
        && matches!(base.as_bytes()[3], b'1'..=b'9'));
    if reserved {
        return Err("working directory contains a reserved Windows device name".into());
    }
    Ok(())
}

fn is_unc_or_device_path(path: &Path) -> bool {
    is_unc_or_device_text(&path.to_string_lossy())
}

fn is_unc_or_device_text(value: &str) -> bool {
    let normalized = value.replace('/', "\\");
    normalized.starts_with("\\\\") || normalized.starts_with("\\?") || normalized.starts_with("\\.")
}

#[cfg(windows)]
fn is_windows_reparse_point(path: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileAttributesW, FILE_ATTRIBUTE_REPARSE_POINT,
    };

    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    // GetFileAttributesW reports reparse metadata for the path itself, including junctions.
    let attributes = unsafe { GetFileAttributesW(wide.as_ptr()) };
    attributes != u32::MAX && attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_windows_reparse_point(_path: &Path) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::{reject_reparse_components, resolve_cwd, resolve_workspace_root};
    use std::fs;
    use std::path::{Path, PathBuf};
    use uuid::Uuid;

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join(format!("path-policy-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&path)
                .expect("test root can be created in the local target directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn workspace_root_uses_configured_absolute_directory() {
        let test_root = TestRoot::new();
        let resolved = resolve_workspace_root(Some(test_root.path().as_os_str()), Path::new("."))
            .expect("configured root should resolve");
        assert_eq!(resolved, fs::canonicalize(test_root.path()).unwrap());
    }

    #[test]
    fn canonical_workspace_root_components_can_be_inspected() {
        let test_root = TestRoot::new();
        let canonical = fs::canonicalize(test_root.path()).unwrap();
        reject_reparse_components(&canonical)
            .expect("canonical workspace root components should be inspectable");
    }

    #[test]
    fn cwd_accepts_workspace_and_nested_directories() {
        let test_root = TestRoot::new();
        fs::create_dir(test_root.path().join("nested")).unwrap();
        let root = fs::canonicalize(test_root.path()).unwrap();
        assert_eq!(resolve_cwd(&root, None).unwrap(), root);
        assert_eq!(
            resolve_cwd(&root, Some("nested")).unwrap(),
            root.join("nested")
        );
    }

    #[test]
    fn cwd_rejects_escape_unc_device_ads_and_reserved_names() {
        let test_root = TestRoot::new();
        let root = fs::canonicalize(test_root.path()).unwrap();
        for invalid in [
            "..",
            "nested/../../outside",
            "C:\\outside",
            "\\\\server\\share",
            "\\\\.\\device",
            "file:stream",
            "NUL.txt",
            "COM1",
        ] {
            assert!(
                resolve_cwd(&root, Some(invalid)).is_err(),
                "accepted {invalid:?}"
            );
        }
    }

    #[test]
    fn cwd_rejects_symbolic_link_components() {
        let test_root = TestRoot::new();
        let root = fs::canonicalize(test_root.path()).unwrap();
        let outside = test_root.path().join("outside");
        let link = test_root.path().join("linked");
        fs::create_dir(&outside).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&outside, &link)
            .expect("Windows test environment must permit creating a directory reparse point");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        assert!(resolve_cwd(&root, Some("linked")).is_err());
    }
}
