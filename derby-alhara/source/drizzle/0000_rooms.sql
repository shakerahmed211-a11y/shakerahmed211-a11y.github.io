CREATE TABLE rooms (code TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX rooms_updated_idx ON rooms(updated);
