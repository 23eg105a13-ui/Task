import { ProfileRecord, RepositoryRecord, LanguageStat } from '../models/types';

/**
 * Converts a raw MySQL profile row into a clean, camelCase API
 * response shape, parsing JSON columns and normalizing types
 * (mysql2 returns DECIMAL as string and TINYINT(1) as 0/1).
 */
export function formatProfile(row: ProfileRecord, topRepos?: RepositoryRecord[]) {
  const topLanguages: LanguageStat[] =
    typeof row.top_languages_json === 'string'
      ? JSON.parse(row.top_languages_json)
      : row.top_languages_json ?? [];

  return {
    id: row.id,
    githubId: row.github_id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    company: row.company,
    location: row.location,
    blog: row.blog,
    twitterUsername: row.twitter_username,
    email: row.email,
    hireable: row.hireable,
    counts: {
      publicRepos: row.public_repos_count,
      publicGists: row.public_gists_count,
      followers: row.followers_count,
      following: row.following_count,
    },
    insights: {
      totalStarsReceived: row.total_stars_received,
      totalForksReceived: row.total_forks_received,
      totalWatchersReceived: row.total_watchers_received,
      mostUsedLanguage: row.most_used_language,
      topLanguages,
      mostStarredRepo: row.most_starred_repo_name
        ? { name: row.most_starred_repo_name, stars: row.most_starred_repo_stars }
        : null,
      accountAgeDays: row.account_age_days,
      activityScore: Number(row.activity_score),
      hasRecentActivity: Boolean(row.has_recent_activity),
      lastRepoPushedAt: row.last_repo_pushed_at,
    },
    topRepositories: topRepos
      ? topRepos.map((r) => ({
          name: r.repo_name,
          fullName: r.repo_full_name,
          description: r.description,
          language: r.language,
          stars: r.stars_count,
          forks: r.forks_count,
          watchers: r.watchers_count,
          isFork: Boolean(r.is_fork),
          url: r.html_url,
          pushedAt: r.repo_pushed_at,
        }))
      : undefined,
    githubCreatedAt: row.github_created_at,
    githubUpdatedAt: row.github_updated_at,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatProfileSummary(row: ProfileRecord) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatar_url,
    followers: row.followers_count,
    publicRepos: row.public_repos_count,
    totalStarsReceived: row.total_stars_received,
    mostUsedLanguage: row.most_used_language,
    activityScore: Number(row.activity_score),
    analyzedAt: row.analyzed_at,
  };
}
