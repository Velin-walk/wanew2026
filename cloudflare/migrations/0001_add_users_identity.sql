-- Migration: 0001_add_users_identity
-- Additive-only "one user, many emails/phones" identity layer

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT,
  profile_json TEXT DEFAULT '{}',
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS user_contacts (
  user_id TEXT NOT NULL REFERENCES users(id),
  type    TEXT NOT NULL,            -- 'uid' | 'email' | 'phone'
  value   TEXT NOT NULL,            -- firebase uid, lowercase email, or E.164 phone
  PRIMARY KEY (type, value)
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON user_contacts(user_id);

ALTER TABLE registrations ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);
