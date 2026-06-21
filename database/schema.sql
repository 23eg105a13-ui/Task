-- =====================================================================
-- GitHub Profile Analyzer — MySQL Schema
-- =====================================================================
-- Run this with:  mysql -u <user> -p < database/schema.sql
-- Or it is applied automatically by `npm run migrate`.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS github_analyzer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE github_analyzer;

-- ---------------------------------------------------------------------
-- profiles
-- One row per analyzed GitHub username. Re-analyzing a username
-- UPDATEs this row (keeps history of "last analyzed" instead of
-- duplicating), see `analysis_runs` below for historical snapshots.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  github_id           BIGINT NOT NULL,
  username            VARCHAR(100) NOT NULL,
  name                VARCHAR(255) DEFAULT NULL,
  avatar_url          VARCHAR(512) DEFAULT NULL,
  bio                 TEXT DEFAULT NULL,
  company             VARCHAR(255) DEFAULT NULL,
  location            VARCHAR(255) DEFAULT NULL,
  blog                VARCHAR(512) DEFAULT NULL,
  twitter_username    VARCHAR(100) DEFAULT NULL,
  email               VARCHAR(255) DEFAULT NULL,
  hireable            BOOLEAN DEFAULT NULL,

  -- Core counts from GitHub
  public_repos_count  INT NOT NULL DEFAULT 0,
  public_gists_count  INT NOT NULL DEFAULT 0,
  followers_count     INT NOT NULL DEFAULT 0,
  following_count     INT NOT NULL DEFAULT 0,

  -- Derived / aggregated insights (computed by our service, not raw GitHub fields)
  total_stars_received    INT NOT NULL DEFAULT 0,
  total_forks_received    INT NOT NULL DEFAULT 0,
  total_watchers_received INT NOT NULL DEFAULT 0,
  most_used_language      VARCHAR(100) DEFAULT NULL,
  top_languages_json       JSON DEFAULT NULL COMMENT 'Array of {language, repoCount, percentage}',
  most_starred_repo_name   VARCHAR(255) DEFAULT NULL,
  most_starred_repo_stars  INT NOT NULL DEFAULT 0,
  account_age_days         INT NOT NULL DEFAULT 0,
  activity_score           DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT 'Weighted score: followers, stars, repos, recency',
  has_recent_activity       BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Pushed a repo in the last 90 days',
  last_repo_pushed_at       DATETIME DEFAULT NULL,

  -- GitHub metadata timestamps
  github_created_at  DATETIME DEFAULT NULL,
  github_updated_at  DATETIME DEFAULT NULL,

  -- Our bookkeeping
  analyzed_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_github_id (github_id),
  INDEX idx_followers (followers_count),
  INDEX idx_activity_score (activity_score),
  INDEX idx_analyzed_at (analyzed_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- analysis_runs
-- Historical log: every time a profile is (re-)analyzed, we snapshot
-- the key metrics here. Lets you track growth over time and gives
-- an audit trail. Optional table but useful and cheap to maintain.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_runs (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  profile_id          INT NOT NULL,
  public_repos_count  INT NOT NULL DEFAULT 0,
  followers_count     INT NOT NULL DEFAULT 0,
  following_count     INT NOT NULL DEFAULT 0,
  total_stars_received INT NOT NULL DEFAULT 0,
  activity_score      DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_analysis_runs_profile
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
    ON DELETE CASCADE,
  INDEX idx_profile_created (profile_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- repositories
-- Top repositories captured per profile at time of analysis
-- (used to compute most-starred repo / language breakdown, and
-- exposed in the single-profile API response for extra detail).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repositories (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  profile_id        INT NOT NULL,
  repo_name         VARCHAR(255) NOT NULL,
  repo_full_name    VARCHAR(512) NOT NULL,
  description       TEXT DEFAULT NULL,
  language          VARCHAR(100) DEFAULT NULL,
  stars_count       INT NOT NULL DEFAULT 0,
  forks_count       INT NOT NULL DEFAULT 0,
  watchers_count    INT NOT NULL DEFAULT 0,
  is_fork           BOOLEAN NOT NULL DEFAULT FALSE,
  html_url          VARCHAR(512) DEFAULT NULL,
  repo_pushed_at    DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_repositories_profile
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
    ON DELETE CASCADE,
  INDEX idx_profile_stars (profile_id, stars_count)
) ENGINE=InnoDB;
