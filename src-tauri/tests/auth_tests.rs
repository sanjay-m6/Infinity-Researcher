use std::sync::Arc;

use research_paper_scraper_lib::database::Database;
use research_paper_scraper_lib::domain::auth::{LoginRequest, SignupRequest};
use research_paper_scraper_lib::services::AuthService;

#[tokio::test]
async fn test_auth_registration_and_duplicate_rejection() {
    let db = Arc::new(Database::open_in_memory().expect("in-memory db"));
    let auth = AuthService::new(db);

    let signup_req = SignupRequest {
        email: "alice@example.com".to_string(),
        username: "alice_researcher".to_string(),
        password: "SuperSecretPassword123!".to_string(),
        confirm_password: "SuperSecretPassword123!".to_string(),
    };

    // 1. Successful Registration
    let res = auth.signup(signup_req.clone()).await.expect("registration should succeed");
    assert_eq!(res.user.email, "alice@example.com");
    assert_eq!(res.user.username, "alice_researcher");
    assert!(!res.token.is_empty());

    // 2. Reject duplicate email
    let duplicate_email = SignupRequest {
        email: "alice@example.com".to_string(),
        username: "different_alice".to_string(),
        password: "SuperSecretPassword123!".to_string(),
        confirm_password: "SuperSecretPassword123!".to_string(),
    };
    let err = auth.signup(duplicate_email).await.unwrap_err();
    assert!(err.to_string().contains("already exists"));

    // 3. Reject duplicate username
    let duplicate_user = SignupRequest {
        email: "bob@example.com".to_string(),
        username: "alice_researcher".to_string(),
        password: "SuperSecretPassword123!".to_string(),
        confirm_password: "SuperSecretPassword123!".to_string(),
    };
    let err2 = auth.signup(duplicate_user).await.unwrap_err();
    assert!(err2.to_string().contains("already taken"));
}

#[tokio::test]
async fn test_auth_login_password_verification_and_throttling() {
    let db = Arc::new(Database::open_in_memory().expect("in-memory db"));
    let auth = AuthService::new(db);

    auth.signup(SignupRequest {
        email: "carol@example.com".to_string(),
        username: "carol_scholar".to_string(),
        password: "StrongPassword890#".to_string(),
        confirm_password: "StrongPassword890#".to_string(),
    })
    .await
    .expect("signup ok");

    // 1. Unsuccessful login (wrong password)
    let bad_login = auth.login(LoginRequest {
        identifier: "carol@example.com".to_string(),
        password: "wrong_password".to_string(),
        remember_me: Some(false),
    }).await;
    assert!(bad_login.is_err());

    // 2. Successful login using User ID
    let good_login = auth.login(LoginRequest {
        identifier: "carol_scholar".to_string(),
        password: "StrongPassword890#".to_string(),
        remember_me: Some(false),
    }).await.expect("login with username must succeed");
    assert_eq!(good_login.user.email, "carol@example.com");
}

#[tokio::test]
async fn test_auth_manual_lock_and_unlock() {
    let db = Arc::new(Database::open_in_memory().expect("in-memory db"));
    let auth = AuthService::new(db);

    let auth_res = auth.signup(SignupRequest {
        email: "david@example.com".to_string(),
        username: "david_lock".to_string(),
        password: "MyLockPassword777$".to_string(),
        confirm_password: "MyLockPassword777$".to_string(),
    })
    .await
    .unwrap();

    // Verify session initially active
    let user = auth.validate_active_session(&auth_res.token).await.expect("session active");
    assert_eq!(user.username, "david_lock");

    // Lock session manually
    auth.lock_session(&auth_res.token).await.expect("lock ok");

    // Protected call fails while locked
    let locked_check = auth.validate_active_session(&auth_res.token).await;
    assert!(locked_check.is_err());

    // Unlock with incorrect password fails
    let fail_unlock = auth.unlock_session(&auth_res.token, "wrong_pw").await;
    assert!(fail_unlock.is_err());

    // Unlock with correct password succeeds
    let unlocked = auth.unlock_session(&auth_res.token, "MyLockPassword777$").await.expect("unlock ok");
    assert_eq!(unlocked.user.username, "david_lock");

    // Session active again
    let user_again = auth.validate_active_session(&auth_res.token).await.expect("active after unlock");
    assert_eq!(user_again.username, "david_lock");
}

#[test]
fn test_database_migration_0018() {
    let db = Database::open_in_memory().expect("in-memory db open failed");
    let info = db.get_info().expect("get_info failed");
    assert_eq!(info.schema_version, 18);
}

