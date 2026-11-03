import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "../tauri-bridge";

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
  last_login_at: string | null;
}

export interface UserPreferences {
  user_id: string;
  auto_lock_timeout_minutes: number;
  remember_me: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  remember_me?: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  remember_me: boolean;
  auto_lock_timeout_minutes: number;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdatePreferencesRequest {
  auto_lock_timeout_minutes: number;
  remember_me: boolean;
  theme?: string;
}

// In-memory mock storage for browser/test preview
let mockUser: User | null = {
  id: "usr_mock_admin",
  email: "admin@infinity-researcher.local",
  username: "admin",
  created_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
};
let mockToken: string | null = "mock-auth-token-123";
let mockLocked = false;
let mockPrefs: UserPreferences = {
  user_id: "usr_mock_admin",
  auto_lock_timeout_minutes: 10,
  remember_me: false,
  theme: "system",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export async function authSignup(req: SignupRequest): Promise<AuthResponse> {
  if (!isTauriEnvironment()) {
    if (req.password !== req.confirm_password) {
      throw new Error("Passwords do not match.");
    }
    mockUser = {
      id: `usr_${Date.now()}`,
      email: req.email.trim(),
      username: req.username.trim(),
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };
    mockToken = `token_${Date.now()}`;
    mockLocked = false;
    return {
      user: mockUser,
      token: mockToken,
      remember_me: false,
      auto_lock_timeout_minutes: 10,
    };
  }
  return invoke<AuthResponse>("auth_signup", { request: req });
}

export async function authLogin(req: LoginRequest): Promise<AuthResponse> {
  if (!isTauriEnvironment()) {
    if (!mockUser) {
      throw new Error("Invalid email/User ID or password.");
    }
    mockToken = `token_${Date.now()}`;
    mockLocked = false;
    return {
      user: mockUser,
      token: mockToken,
      remember_me: req.remember_me || false,
      auto_lock_timeout_minutes: mockPrefs.auto_lock_timeout_minutes,
    };
  }
  return invoke<AuthResponse>("auth_login", { request: req });
}

export async function authLogout(token: string): Promise<void> {
  if (!isTauriEnvironment()) {
    mockToken = null;
    mockLocked = false;
    return;
  }
  return invoke<void>("auth_logout", { token });
}

export async function authLock(token: string): Promise<void> {
  if (!isTauriEnvironment()) {
    mockLocked = true;
    return;
  }
  return invoke<void>("auth_lock", { token });
}

export async function authUnlock(token: string, password: string): Promise<AuthResponse> {
  if (!isTauriEnvironment()) {
    if (!password) {
      throw new Error("Password is required.");
    }
    mockLocked = false;
    return {
      user: mockUser!,
      token,
      remember_me: mockPrefs.remember_me,
      auto_lock_timeout_minutes: mockPrefs.auto_lock_timeout_minutes,
    };
  }
  return invoke<AuthResponse>("auth_unlock", { token, password });
}

export async function authGetCurrentSession(
  token?: string | null
): Promise<AuthResponse | null> {
  if (!isTauriEnvironment()) {
    if (token && mockUser && !mockLocked) {
      return {
        user: mockUser,
        token,
        remember_me: mockPrefs.remember_me,
        auto_lock_timeout_minutes: mockPrefs.auto_lock_timeout_minutes,
      };
    }
    return null;
  }
  return invoke<AuthResponse | null>("auth_get_current_session", {
    token: token || null,
  });
}

export async function authRestoreRememberedSession(): Promise<AuthResponse | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  return invoke<AuthResponse | null>("auth_restore_remembered_session");
}

export async function authGetPreferences(token: string): Promise<UserPreferences> {
  if (!isTauriEnvironment()) {
    return mockPrefs;
  }
  return invoke<UserPreferences>("auth_get_preferences", { token });
}

export async function authUpdatePreferences(
  token: string,
  request: UpdatePreferencesRequest
): Promise<UserPreferences> {
  if (!isTauriEnvironment()) {
    mockPrefs = {
      ...mockPrefs,
      auto_lock_timeout_minutes: request.auto_lock_timeout_minutes,
      remember_me: request.remember_me,
      theme: request.theme || mockPrefs.theme,
      updated_at: new Date().toISOString(),
    };
    return mockPrefs;
  }
  return invoke<UserPreferences>("auth_update_preferences", { token, request });
}

export async function authChangePassword(
  token: string,
  request: ChangePasswordRequest
): Promise<void> {
  if (!isTauriEnvironment()) {
    if (!request.new_password || request.new_password.length < 8) {
      throw new Error("New password must be at least 8 characters long.");
    }
    return;
  }
  return invoke<void>("auth_change_password", { token, request });
}

export async function authTouchActivity(token: string): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }
  try {
    await invoke<void>("auth_touch_activity", { token });
  } catch {
    // Non-critical background ping
  }
}
