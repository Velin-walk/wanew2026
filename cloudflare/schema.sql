-- Walk Nepal Walk D1 Database Schema
-- Matches the active Cloudflare D1 production database layout

-- 1. Treks / Itineraries Table
CREATE TABLE IF NOT EXISTS treks (
  hike_number TEXT PRIMARY KEY,
  id TEXT,
  title TEXT,
  category TEXT,
  status TEXT,
  cover_image_url TEXT,
  hike_date TEXT,
  min_price INTEGER,
  max_price INTEGER,
  currency TEXT,
  meeting_point TEXT,
  meeting_time TEXT,
  expected_duration TEXT,
  difficulty TEXT,
  approx_distance TEXT,
  elevation_range TEXT,
  elevation_gross TEXT,
  ending_point TEXT,
  team_leader TEXT,
  whatsapp_link TEXT,
  itinerary_link TEXT,
  faq_link TEXT,
  max_capacity INTEGER,
  data_json TEXT,
  author_email TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- 2. Registrations / Bookings Table (Consolidated layout)
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  trek_name TEXT,
  full_name TEXT,
  pax INTEGER,
  whatsapp_number TEXT,
  emergency_backup_contact TEXT,
  email_address TEXT,
  profession TEXT,
  part_of_group TEXT,
  list_name TEXT, -- Captures the role & context (e.g., Solo, Primary contact with companions, Companion of ...)
  age_group TEXT,
  gender TEXT,
  fitness TEXT,
  medical_condition TEXT,
  recent_hikes TEXT,
  agreement TEXT,
  suggestions TEXT,
  guide_mode TEXT,
  transport_mode TEXT,
  hike_number TEXT
);

-- 3. Bookings Roster / Active Edits Table
CREATE TABLE IF NOT EXISTS bookings_roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id TEXT,
  hike_number TEXT,
  trek_name TEXT,
  trek_date TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  registration_status TEXT,
  payment_status TEXT,
  paid_amount REAL,
  due_amount REAL,
  admin_notes TEXT,
  pickup_point TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- 4. Event Executions Table
CREATE TABLE IF NOT EXISTS event_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hike_number TEXT,
  trek_name TEXT,
  event_date TEXT,
  execution_status TEXT,
  is_cancelled INTEGER,
  cancellation_reason TEXT,
  capacity INTEGER,
  assigned_leader TEXT,
  leader_phone TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- 5. Community Trails Table (Integrated for MapMiners)
CREATE TABLE IF NOT EXISTS community_trails (
  id TEXT PRIMARY KEY,
  file_name TEXT,
  name TEXT,
  description TEXT,
  difficulty TEXT,
  distance REAL,
  elevation_gain REAL,
  elevation_loss REAL,
  min_elevation REAL,
  max_elevation REAL,
  estimated_hours REAL,
  bounds TEXT,
  start_pos TEXT,
  contributor_name TEXT,
  contributor_email TEXT,
  province TEXT,
  district TEXT,
  nearby_city TEXT,
  highlights TEXT,
  uploaded_at DATETIME,
  fileName TEXT,
  fileSize INTEGER,
  contributorEmail TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'approved'
);

-- 6. Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT,
  hike_number TEXT,
  trek_name TEXT,
  full_name TEXT,
  email_address TEXT,
  team_rating INTEGER,
  team_feedback TEXT,
  overall_rating INTEGER,
  overall_feedback TEXT,
  submitted_at TIMESTAMP
);

-- 7. Items / Dynamic Tags Table
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  updated_at DATETIME
);

-- 8. Trek Photos / Community Gallery Table
CREATE TABLE IF NOT EXISTS trek_photos (
  id TEXT PRIMARY KEY,
  trek_id TEXT,
  hike_number TEXT,
  trek_name TEXT,
  url TEXT,
  public_id TEXT,
  uploaded_by TEXT,
  user_uid TEXT,
  uploaded_at DATETIME,
  caption TEXT
);

-- 9. Photo Comments Table
CREATE TABLE IF NOT EXISTS photo_comments (
  id TEXT PRIMARY KEY,
  photo_id TEXT,
  user_uid TEXT,
  user_name TEXT,
  user_avatar TEXT,
  comment_text TEXT,
  created_at DATETIME
);

-- 10. Individual Hiker Profiles (Pre-aggregated Single-Row Document: 1-row O(1) read access)
CREATE TABLE IF NOT EXISTS hiker_profiles (
  -- 1. PRIMARY KEY & AUTHENTICATION
  email TEXT PRIMARY KEY,
  user_uid TEXT,

  -- 2. IDENTITY & CONTACT (From Registrations)
  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  gender TEXT,
  age_group TEXT,
  profession TEXT,
  city TEXT,
  avatar_url TEXT,

  -- 3. MEDICAL & SAFETY (From Registrations)
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  blood_group TEXT,
  fitness_level TEXT,
  medical_conditions TEXT,

  -- 4. PRE-COMPUTED AGGREGATES (Instant Numbers)
  total_hikes INTEGER DEFAULT 0,
  total_paid_amount REAL DEFAULT 0,
  total_due_amount REAL DEFAULT 0,
  total_distance_km REAL DEFAULT 0,
  total_trails_contributed INTEGER DEFAULT 0,
  total_photos_uploaded INTEGER DEFAULT 0,
  total_comments_made INTEGER DEFAULT 0,
  highest_altitude_m INTEGER DEFAULT 0,
  rank_title TEXT DEFAULT 'Trail Explorer',

  -- 5. NESTED ARRAYS & DEEP DATA (Zero Data Loss)
  badges_json TEXT DEFAULT '[]',          -- e.g. ["first_hike", "5_hikes_milestone"]
  hikes_json TEXT DEFAULT '[]',           -- Complete lifecycle of all registrations & bookings
  contributions_json TEXT DEFAULT '{}',   -- Trails uploaded, photos shared, comments made

  -- 6. METADATA
  first_hike_date TEXT,
  last_hike_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. System Snapshots Table (Single-row precomputed payloads for leaderboards & analytics)
CREATE TABLE IF NOT EXISTS system_snapshots (
  key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Ultra-Low Row Reads & High-Speed Querying
CREATE INDEX IF NOT EXISTS idx_photo_comments_photo_id ON photo_comments (photo_id);
CREATE INDEX IF NOT EXISTS idx_regs_hike_number ON registrations (hike_number);
CREATE INDEX IF NOT EXISTS idx_regs_email ON registrations (email_address);
CREATE INDEX IF NOT EXISTS idx_regs_email_lower ON registrations (LOWER(email_address));
CREATE INDEX IF NOT EXISTS idx_regs_user_email_lower ON registrations (LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_regs_timestamp ON registrations (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_roster_reg_id ON bookings_roster (registration_id);
CREATE INDEX IF NOT EXISTS idx_roster_hike_number ON bookings_roster (hike_number);
CREATE INDEX IF NOT EXISTS idx_roster_email_lower ON bookings_roster (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_treks_created_at ON treks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treks_hike_number ON treks (hike_number);
CREATE INDEX IF NOT EXISTS idx_executions_hike_number ON event_executions (hike_number);
CREATE INDEX IF NOT EXISTS idx_trek_photos_trek_id ON trek_photos (trek_id);
CREATE INDEX IF NOT EXISTS idx_community_trails_status ON community_trails (status);
CREATE INDEX IF NOT EXISTS idx_hiker_email_lower ON hiker_profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_hiker_total_hikes ON hiker_profiles (total_hikes DESC);
CREATE INDEX IF NOT EXISTS idx_hiker_uid ON hiker_profiles (user_uid);


