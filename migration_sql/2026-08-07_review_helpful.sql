ALTER TABLE reviews ADD COLUMN comments TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS review_helpful (
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_review
    ON review_helpful(review_id);
