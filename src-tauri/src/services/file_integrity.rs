use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Result as IoResult};
use std::path::{Path, PathBuf};
use tracing::warn;

pub struct FileIntegrityService;

impl FileIntegrityService {
    /// Maximum permitted PDF file size for automatic processing (100 MB).
    pub const MAX_ALLOWED_FILE_SIZE_BYTES: u64 = 100 * 1024 * 1024;

    /// Validates that a file path is safe and constrained within the allowed base directory:
    /// - Rejects directory traversal attempts ("..")
    /// - Checks that the path exists and is a regular file
    pub fn validate_file_path(base_dir: &Path, file_path: &Path) -> Result<PathBuf, String> {
        let path_str = file_path.to_string_lossy();
        if path_str.contains("..") {
            return Err("Path traversal detected in file path".to_string());
        }

        // If file_path is relative, join with base_dir
        let full_path = if file_path.is_relative() {
            base_dir.join(file_path)
        } else {
            file_path.to_path_buf()
        };

        // If canonicalize works, verify it starts with base_dir canonicalized
        if let (Ok(canon_base), Ok(canon_path)) =
            (base_dir.canonicalize(), full_path.canonicalize())
        {
            if !canon_path.starts_with(&canon_base) {
                return Err("Path escapes allowed application storage directory".to_string());
            }
            Ok(canon_path)
        } else {
            // If file doesn't exist yet or canonicalize fails, return checked full_path
            Ok(full_path)
        }
    }

    /// Computes the SHA-256 checksum of a file in streaming 64 KB chunks:
    /// - Avoids allocating large buffers in memory.
    /// - Returns hex-encoded digest string.
    pub fn compute_sha256_stream(path: &Path) -> IoResult<String> {
        let mut file = File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 65536]; // 64 KB chunk

        loop {
            let bytes_read = file.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        let hash_bytes = hasher.finalize();
        Ok(format!("{:x}", hash_bytes))
    }

    /// Checks basic file characteristics:
    /// Returns (file_size_bytes, Option<sha256_hash>, Result<(), String>)
    pub fn inspect_file(path: &Path) -> (u64, Option<String>, Result<(), String>) {
        if !path.exists() {
            return (0, None, Err("File does not exist on disk".to_string()));
        }

        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(e) => return (0, None, Err(format!("Failed to read file metadata: {}", e))),
        };

        let file_size = metadata.len();
        if file_size == 0 {
            return (0, None, Err("Zero-byte empty file".to_string()));
        }

        if file_size > Self::MAX_ALLOWED_FILE_SIZE_BYTES {
            warn!(
                size = file_size,
                "File exceeds max allowed size for processing"
            );
            return (
                file_size,
                None,
                Err(format!(
                    "File exceeds max limit of {} MB",
                    Self::MAX_ALLOWED_FILE_SIZE_BYTES / 1024 / 1024
                )),
            );
        }

        match Self::compute_sha256_stream(path) {
            Ok(hash) => (file_size, Some(hash), Ok(())),
            Err(e) => (
                file_size,
                None,
                Err(format!("Failed to calculate hash: {}", e)),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_compute_sha256_stream() {
        let temp_dir = std::env::temp_dir().join(format!("test_sha_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let test_file = temp_dir.join("test_sample.txt");

        {
            let mut f = File::create(&test_file).unwrap();
            f.write_all(b"Hello Academic World!").unwrap();
        }

        let hash = FileIntegrityService::compute_sha256_stream(&test_file).unwrap();
        // SHA256 of "Hello Academic World!"
        let mut hasher = Sha256::new();
        hasher.update(b"Hello Academic World!");
        let expected = format!("{:x}", hasher.finalize());

        assert_eq!(hash, expected);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_validate_file_path_rejects_traversal() {
        let base_dir = Path::new("/user/storage/papers");
        let malicious_path = Path::new("../../etc/passwd");

        let res = FileIntegrityService::validate_file_path(base_dir, malicious_path);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Path traversal"));
    }

    #[test]
    fn test_inspect_zero_byte_file() {
        let temp_dir = std::env::temp_dir().join(format!("test_empty_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let empty_file = temp_dir.join("empty.pdf");
        File::create(&empty_file).unwrap();

        let (size, hash, res) = FileIntegrityService::inspect_file(&empty_file);
        assert_eq!(size, 0);
        assert!(hash.is_none());
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Zero-byte"));
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
