-- =============================================
-- Pickleball Open — Supabase Schema
-- =============================================

-- 1. Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tournament state (pairs + bracket as JSON)
CREATE TABLE IF NOT EXISTS tournament_data (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_data ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (no auth required for this tournament app)
CREATE POLICY "Allow public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update players" ON players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete players" ON players FOR DELETE USING (true);

CREATE POLICY "Allow public read tournament_data" ON tournament_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert tournament_data" ON tournament_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tournament_data" ON tournament_data FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tournament_data" ON tournament_data FOR DELETE USING (true);

-- Enable realtime for tournament_data
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_data;

-- Seed players
INSERT INTO players (id, name, display_name, image_url, gender, sort_order) VALUES
  ('a-dung-gia', 'Dũng Lớn', 'a Dũng Lớn', '/hinhmn/a-dung-gia.jpeg', 'male', 1),
  ('a-dung', 'Dũng', 'a Dũng nhỏ', '/hinhmn/a-dung.jpeg', 'male', 2),
  ('a-duy', 'Duy', 'a Duy', '/hinhmn/a-duy.jpeg', 'male', 3),
  ('a-phap', 'Pháp', 'a Pháp', '/hinhmn/a-phap.jpeg', 'male', 4),
  ('a-thin', 'Thìn', 'a Thìn', '/hinhmn/a-thin.jpeg', 'male', 5),
  ('a-tuyen', 'Tuyến', 'a Tuyến', '/hinhmn/a-tuyen.jpeg', 'male', 6),
  ('a-bao', 'Bảo', 'a Bảo', '/hinhmn/a-bao.jpeg', 'male', 7),
  ('c-kieu', 'Kiều', 'c Kiều', '/hinhmn/c-kieu.jpeg', 'female', 1),
  ('c-me', 'Me', 'Trẻ nhất', '/hinhmn/c-me.jpg', 'female', 2),
  ('c-quynh', 'Quỳnh', 'c Quỳnh', '/hinhmn/c-quynh.jpeg', 'female', 3),
  ('c-thao', 'Thảo', 'c Ngô Thảo', '/hinhmn/c-thao.jpeg', 'female', 4),
  ('c-thu', 'Thư', 'c Thu Julie', '/hinhmn/c-thu.jpeg', 'female', 5),
  ('c-truc', 'Trúc', 'c Trúc', '/hinhmn/c-truc.jpeg', 'female', 6),
  ('c-thanh-thao', 'Thanh Thảo', 'c Thanh Thảo', '/hinhmn/c-thanh-thao.jpeg', 'female', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  image_url = EXCLUDED.image_url,
  gender = EXCLUDED.gender,
  sort_order = EXCLUDED.sort_order;

-- Seed initial tournament data
INSERT INTO tournament_data (key, data) VALUES
  ('pairs', '[]'::jsonb),
  ('bracket', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
