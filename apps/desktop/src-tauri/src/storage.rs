use crate::path_policy::{
    ensure_directory_without_reparse, reject_hard_linked_file, reject_reparse_components,
};
use rusqlite::{params, Connection, TransactionBehavior};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub(crate) const MAX_LAYOUT_BYTES: usize = 1024 * 1024;
const MAX_NODES: usize = 256;
const MAX_EDGES: usize = 1024;
const MAX_GROUPS: usize = 128;

pub(crate) struct WorkspaceDb {
    path: PathBuf,
    connection: Mutex<Connection>,
}

impl WorkspaceDb {
    pub(crate) fn open(root: &Path) -> Result<Self, String> {
        let state_dir = root.join(".ciranda");
        ensure_directory_without_reparse(&state_dir)?;
        let path = state_dir.join("state.sqlite");
        reject_reparse_components(&path)?;
        reject_hard_linked_file(&path)?;
        if path.exists()
            && !fs::symlink_metadata(&path)
                .map_err(|_| "workspace database cannot be inspected")?
                .is_file()
        {
            return Err("workspace database path is not a file".into());
        }

        let connection =
            Connection::open(&path).map_err(|_| "workspace database cannot be opened")?;
        reject_reparse_components(&path)?;
        reject_hard_linked_file(&path)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "workspace database is unavailable")?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|_| "workspace database is unavailable")?;
        connection
            .pragma_update(None, "synchronous", "FULL")
            .map_err(|_| "workspace database is unavailable")?;

        let check: String = connection
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(|_| "workspace database integrity check failed")?;
        if check != "ok" {
            return Err("workspace database integrity check failed".into());
        }

        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|_| "workspace database version cannot be read")?;
        if version > 1 {
            return Err("workspace database version is newer than this application".into());
        }
        if version == 0 {
            let transaction = connection
                .unchecked_transaction()
                .map_err(|_| "workspace database migration failed")?;
            transaction
                .execute_batch(
                    "CREATE TABLE IF NOT EXISTS workspace_layout (
                        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                        version INTEGER NOT NULL CHECK (version = 1),
                        layout_json TEXT NOT NULL,
                        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    PRAGMA user_version = 1;",
                )
                .map_err(|_| "workspace database migration failed")?;
            transaction
                .commit()
                .map_err(|_| "workspace database migration failed")?;
        }

        Ok(Self {
            path,
            connection: Mutex::new(connection),
        })
    }

    pub(crate) fn load(&self) -> Result<Option<String>, String> {
        reject_reparse_components(&self.path)?;
        let connection = self
            .connection
            .lock()
            .map_err(|_| "workspace database is unavailable")?;
        let layout = connection
            .query_row(
                "SELECT layout_json FROM workspace_layout WHERE singleton = 1 AND version = 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|_| "workspace layout cannot be loaded")?;
        if let Some(json) = &layout {
            validate_layout(json)?;
        }
        Ok(layout)
    }

    pub(crate) fn save(&self, layout_json: &str) -> Result<(), String> {
        validate_layout(layout_json)?;
        reject_reparse_components(&self.path)?;
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "workspace database is unavailable")?;
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| "workspace layout cannot be saved")?;
        transaction
            .execute(
                "INSERT INTO workspace_layout (singleton, version, layout_json, updated_at)
                 VALUES (1, 1, ?1, CURRENT_TIMESTAMP)
                 ON CONFLICT(singleton) DO UPDATE SET
                    version = excluded.version,
                    layout_json = excluded.layout_json,
                    updated_at = excluded.updated_at",
                params![layout_json],
            )
            .map_err(|_| "workspace layout cannot be saved")?;
        transaction
            .commit()
            .map_err(|_| "workspace layout cannot be saved")
    }
}

trait OptionalRow<T> {
    fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalRow<T> for rusqlite::Result<T> {
    fn optional(self) -> rusqlite::Result<Option<T>> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Layout {
    version: u8,
    viewport: Viewport,
    nodes: Vec<Node>,
    edges: Vec<Edge>,
    groups: Vec<Group>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Viewport {
    x: f64,
    y: f64,
    zoom: f64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Node {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    title: String,
    #[serde(rename = "sessionId")]
    _session_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Edge {
    id: String,
    source: String,
    target: String,
    #[serde(rename = "type")]
    kind: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Group {
    id: String,
    title: String,
    node_ids: Vec<String>,
}

pub(crate) fn validate_layout(json: &str) -> Result<(), String> {
    if json.len() > MAX_LAYOUT_BYTES {
        return Err("workspace layout exceeds the size limit".into());
    }
    let layout: Layout =
        serde_json::from_str(json).map_err(|_| "workspace layout JSON is invalid")?;
    if layout.version != 1 {
        return Err("workspace layout version is unsupported".into());
    }
    if !layout.viewport.x.is_finite()
        || !layout.viewport.y.is_finite()
        || !layout.viewport.zoom.is_finite()
        || layout.viewport.x.abs() > 1_000_000.0
        || layout.viewport.y.abs() > 1_000_000.0
        || !(0.1..=4.0).contains(&layout.viewport.zoom)
    {
        return Err("workspace viewport is outside allowed bounds".into());
    }
    if layout.nodes.len() > MAX_NODES
        || layout.edges.len() > MAX_EDGES
        || layout.groups.len() > MAX_GROUPS
    {
        return Err("workspace layout contains too many objects".into());
    }

    let mut node_ids = std::collections::HashSet::with_capacity(layout.nodes.len());
    for node in &layout.nodes {
        validate_text(&node.id, 128, "node id")?;
        validate_text(&node.title, 512, "node title")?;
        if node.kind != "terminal"
            || !node.x.is_finite()
            || !node.y.is_finite()
            || !node.width.is_finite()
            || !node.height.is_finite()
            || node.x.abs() > 1_000_000.0
            || node.y.abs() > 1_000_000.0
            || !(1.0..=10_000.0).contains(&node.width)
            || !(1.0..=10_000.0).contains(&node.height)
        {
            return Err("workspace node is invalid".into());
        }
        if !node_ids.insert(node.id.as_str()) {
            return Err("workspace layout contains duplicate node ids".into());
        }
    }

    let mut edge_ids = std::collections::HashSet::with_capacity(layout.edges.len());
    for edge in &layout.edges {
        validate_text(&edge.id, 128, "edge id")?;
        if edge.kind != "context_reference"
            || edge.source == edge.target
            || !node_ids.contains(edge.source.as_str())
            || !node_ids.contains(edge.target.as_str())
        {
            return Err("workspace edge is invalid".into());
        }
        if !edge_ids.insert(edge.id.as_str()) {
            return Err("workspace layout contains duplicate edge ids".into());
        }
    }

    let mut group_ids = std::collections::HashSet::with_capacity(layout.groups.len());
    for group in &layout.groups {
        validate_text(&group.id, 128, "group id")?;
        validate_text(&group.title, 512, "group title")?;
        if !group_ids.insert(group.id.as_str()) {
            return Err("workspace layout contains duplicate group ids".into());
        }
        let mut members = std::collections::HashSet::with_capacity(group.node_ids.len());
        for node_id in &group.node_ids {
            if !node_ids.contains(node_id.as_str()) || !members.insert(node_id.as_str()) {
                return Err("workspace group references an invalid node".into());
            }
        }
    }
    Ok(())
}

fn validate_text(value: &str, max_bytes: usize, field: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > max_bytes || value.chars().any(char::is_control) {
        return Err(format!("workspace {field} is invalid"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_layout, WorkspaceDb, MAX_LAYOUT_BYTES};
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join(format!("storage-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&path)
                .expect("test root can be created in the local target directory");
            Self(path)
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    const VALID_LAYOUT: &str = r#"{"version":1,"viewport":{"x":0,"y":0,"zoom":1},"nodes":[{"id":"terminal-1","type":"terminal","x":10,"y":20,"width":480,"height":300,"title":"Terminal","sessionId":"stale-session"}],"edges":[],"groups":[]}"#;

    #[test]
    fn layout_validator_accepts_v1_and_rejects_invalid_shapes() {
        assert!(validate_layout(VALID_LAYOUT).is_ok());
        assert!(
            validate_layout(&format!("{}{}", VALID_LAYOUT, " ".repeat(MAX_LAYOUT_BYTES))).is_err()
        );
        assert!(validate_layout(&VALID_LAYOUT.replace("\"version\":1", "\"version\":2")).is_err());
        assert!(validate_layout(&VALID_LAYOUT.replace("\"zoom\":1", "\"zoom\":99")).is_err());
        assert!(validate_layout(
            &VALID_LAYOUT.replace("\"type\":\"terminal\"", "\"type\":\"process\"")
        )
        .is_err());
        assert!(validate_layout(&VALID_LAYOUT.replace(
            "\"title\":\"Terminal\"",
            "\"title\":\"Terminal\",\"unknown\":true"
        ))
        .is_err());
        assert!(validate_layout(&VALID_LAYOUT.replace("\"edges\":[]", "\"edges\":[{\"id\":\"e\",\"source\":\"missing\",\"target\":\"terminal-1\",\"type\":\"context_reference\"}]")).is_err());
    }

    #[test]
    fn sqlite_layout_round_trip_and_invalid_save_is_non_mutating() {
        let root = TestRoot::new();
        let db = WorkspaceDb::open(&root.0).unwrap();
        assert_eq!(db.load().unwrap(), None);
        db.save(VALID_LAYOUT).unwrap();
        assert_eq!(db.load().unwrap().as_deref(), Some(VALID_LAYOUT));
        assert!(db.save("{\"version\": 2}").is_err());
        assert_eq!(db.load().unwrap().as_deref(), Some(VALID_LAYOUT));
    }

    #[test]
    fn sqlite_refuses_database_symlink() {
        let root = TestRoot::new();
        let state = root.0.join(".ciranda");
        fs::create_dir(&state).unwrap();
        let target = root.0.join("elsewhere.sqlite");
        fs::write(&target, b"do not open through a link").unwrap();
        let link = state.join("state.sqlite");
        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&target, &link)
            .expect("Windows test environment must permit creating a file reparse point");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(WorkspaceDb::open(&root.0).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"do not open through a link");
    }

    #[test]
    fn sqlite_refuses_database_hard_link() {
        let root = TestRoot::new();
        let state = root.0.join(".ciranda");
        fs::create_dir(&state).unwrap();
        let target = root.0.join("elsewhere.sqlite");
        fs::write(&target, b"do not open through a hard link").unwrap();
        let link = state.join("state.sqlite");
        fs::hard_link(&target, &link).expect("test filesystem must permit same-volume hard links");
        assert!(WorkspaceDb::open(&root.0).is_err());
        assert_eq!(
            fs::read(&target).unwrap(),
            b"do not open through a hard link"
        );
    }
}
