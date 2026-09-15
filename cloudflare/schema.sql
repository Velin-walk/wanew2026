-- D1 Schema for Walk Nepal Walk & MapMiners

-- Treks / Itineraries Table
CREATE TABLE IF NOT EXISTS treks (
  id TEXT PRIMARY KEY,
  hike_number TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Overnight Bus Hikes',
  status TEXT DEFAULT 'published',
  author_email TEXT,
  created_at TEXT,
  updated_at TEXT,
  data TEXT -- JSON blob containing complete itinerary details
);

-- Registrations / Bookings Table
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trek_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  emergency_contact TEXT,
  profession TEXT,
  is_group INTEGER DEFAULT 0,
  age_group TEXT,
  gender TEXT,
  joined_at TEXT,
  trek_name TEXT,
  trek_date TEXT,
  trek_difficulty TEXT,
  trek_days TEXT,
  team_members TEXT, -- JSON string of companions
  has_medical INTEGER DEFAULT 0,
  specify_medical TEXT,
  recent_hikes TEXT,
  agree_rules INTEGER DEFAULT 1,
  guide_preference TEXT,
  transport_preference TEXT,
  suggestions TEXT
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  recent_walk TEXT,
  hike_number TEXT,
  team_feedback TEXT,
  team_rating INTEGER DEFAULT 5,
  overall_feedback TEXT,
  overall_rating INTEGER DEFAULT 5,
  submitted_at TEXT
);

-- Community Trails Metadata Table (used by Walk Nepal Walk & MapMiners)
CREATE TABLE IF NOT EXISTS community_trails (
  id TEXT PRIMARY KEY,
  file_name TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT DEFAULT 'Moderate',
  distance REAL DEFAULT 0,
  elevation_gain REAL DEFAULT 0,
  elevation_loss REAL DEFAULT 0,
  min_elevation REAL DEFAULT 0,
  max_elevation REAL DEFAULT 0,
  estimated_hours REAL DEFAULT 0,
  bounds TEXT,
  start_pos TEXT,
  contributor_name TEXT,
  contributor_email TEXT,
  province TEXT,
  district TEXT,
  nearby_city TEXT,
  highlights TEXT,
  uploaded_at TEXT,
  file_size INTEGER DEFAULT 0
);

-- MapMiners Trails Metadata Table (alias/legacy)
CREATE TABLE IF NOT EXISTS mapminers_trails (
  id TEXT PRIMARY KEY,
  file_name TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  difficulty_override TEXT,
  hours_override TEXT,
  province TEXT,
  district TEXT,
  nearby_city TEXT,
  highlights TEXT,
  uploaded_at TEXT,
  contributor_name TEXT,
  contributor_email TEXT,
  start_lat REAL,
  start_lng REAL,
  stats TEXT -- JSON string containing distance, elevationGain, etc.
);
