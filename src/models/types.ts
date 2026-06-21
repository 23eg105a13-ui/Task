// =====================================================================
// Shared type definitions
// =====================================================================

/** Raw shape of the GitHub /users/{username} response (fields we use). */
export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  email: string | null;
  hireable: boolean | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/** Raw shape of items from /users/{username}/repos (fields we use). */
export interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  fork: boolean;
  html_url: string;
  pushed_at: string | null;
  archived: boolean;
}

/** A single entry in the computed top-languages breakdown. */
export interface LanguageStat {
  language: string;
  repoCount: number;
  percentage: number;
}

/** Insights we compute ourselves from raw GitHub data before persisting. */
export interface ComputedInsights {
  totalStarsReceived: number;
  totalForksReceived: number;
  totalWatchersReceived: number;
  mostUsedLanguage: string | null;
  topLanguages: LanguageStat[];
  mostStarredRepoName: string | null;
  mostStarredRepoStars: number;
  accountAgeDays: number;
  activityScore: number;
  hasRecentActivity: boolean;
  lastRepoPushedAt: string | null;
}

/** Full row shape as stored in / read from the `profiles` table. */
export interface ProfileRecord {
  id: number;
  github_id: number;
  username: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  email: string | null;
  hireable: boolean | null;
  public_repos_count: number;
  public_gists_count: number;
  followers_count: number;
  following_count: number;
  total_stars_received: number;
  total_forks_received: number;
  total_watchers_received: number;
  most_used_language: string | null;
  top_languages_json: string | LanguageStat[] | null;
  most_starred_repo_name: string | null;
  most_starred_repo_stars: number;
  account_age_days: number;
  activity_score: string | number;
  has_recent_activity: number | boolean;
  last_repo_pushed_at: string | null;
  github_created_at: string | null;
  github_updated_at: string | null;
  analyzed_at: string;
  created_at: string;
  updated_at: string;
}

export interface RepositoryRecord {
  id: number;
  profile_id: number;
  repo_name: string;
  repo_full_name: string;
  description: string | null;
  language: string | null;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  is_fork: number | boolean;
  html_url: string | null;
  repo_pushed_at: string | null;
}

export interface PaginationQuery {
  page: number;
  limit: number;
}

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}
