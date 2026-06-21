import {
  GitHubRepoResponse,
  GitHubUserResponse,
  ComputedInsights,
  LanguageStat,
} from '../models/types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const RECENT_ACTIVITY_WINDOW_DAYS = 90;

/**
 * Computes derived insights from a user's raw profile + repo list.
 * None of these fields come directly from a single GitHub API field —
 * they are aggregated/calculated by us, which is the "useful insight"
 * layer the assignment asks for beyond simple counts.
 */
export function computeInsights(
  user: GitHubUserResponse,
  repos: GitHubRepoResponse[]
): ComputedInsights {
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);
  // Fall back to all repos (including forks) if the user has no
  // original repos at all, so stats aren't needlessly zeroed out.
  const reposForStats = nonForkRepos.length > 0 ? nonForkRepos : repos;

  const totalStarsReceived = sum(reposForStats.map((r) => r.stargazers_count));
  const totalForksReceived = sum(reposForStats.map((r) => r.forks_count));
  const totalWatchersReceived = sum(reposForStats.map((r) => r.watchers_count));

  const topLanguages = computeLanguageBreakdown(reposForStats);
  const mostUsedLanguage = topLanguages[0]?.language ?? null;

  const mostStarredRepo = [...reposForStats].sort(
    (a, b) => b.stargazers_count - a.stargazers_count
  )[0];

  const accountAgeDays = daysBetween(new Date(user.created_at), new Date());

  const lastPushedDates = repos
    .map((r) => (r.pushed_at ? new Date(r.pushed_at) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  const lastRepoPushedAt = lastPushedDates[0] ?? null;
  const hasRecentActivity = lastRepoPushedAt
    ? daysBetween(lastRepoPushedAt, new Date()) <= RECENT_ACTIVITY_WINDOW_DAYS
    : false;

  const activityScore = computeActivityScore({
    followers: user.followers,
    publicRepos: user.public_repos,
    totalStars: totalStarsReceived,
    accountAgeDays,
    hasRecentActivity,
  });

  return {
    totalStarsReceived,
    totalForksReceived,
    totalWatchersReceived,
    mostUsedLanguage,
    topLanguages,
    mostStarredRepoName: mostStarredRepo?.name ?? null,
    mostStarredRepoStars: mostStarredRepo?.stargazers_count ?? 0,
    accountAgeDays,
    activityScore,
    hasRecentActivity,
    lastRepoPushedAt: lastRepoPushedAt ? lastRepoPushedAt.toISOString() : null,
  };
}

function computeLanguageBreakdown(repos: GitHubRepoResponse[]): LanguageStat[] {
  const counts = new Map<string, number>();

  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }

  const totalWithLanguage = sum(Array.from(counts.values()));
  if (totalWithLanguage === 0) return [];

  return Array.from(counts.entries())
    .map(([language, repoCount]) => ({
      language,
      repoCount,
      percentage: Math.round((repoCount / totalWithLanguage) * 1000) / 10, // 1 decimal
    }))
    .sort((a, b) => b.repoCount - a.repoCount)
    .slice(0, 10); // top 10 languages is plenty for a summary
}

/**
 * A 0-100 weighted score meant to give a quick "at a glance" sense
 * of how active/established a profile is. Weights are intentionally
 * simple and documented so they're easy to defend or tweak:
 *   - followers: social proof, log-scaled so 10k followers doesn't
 *     dwarf everything else
 *   - totalStars: signal of code quality/impact, log-scaled
 *   - publicRepos: breadth of work, capped contribution
 *   - account age: rewards established accounts slightly
 *   - recent activity: flat bonus for being currently active
 */
function computeActivityScore(params: {
  followers: number;
  publicRepos: number;
  totalStars: number;
  accountAgeDays: number;
  hasRecentActivity: boolean;
}): number {
  const { followers, publicRepos, totalStars, accountAgeDays, hasRecentActivity } = params;

  const followerScore = Math.log10(followers + 1) * 10; // up to ~40 for 10k followers
  const starScore = Math.log10(totalStars + 1) * 10; // up to ~40 for 10k stars
  const repoScore = Math.min(publicRepos, 50) * 0.4; // capped at 20 points
  const ageScore = Math.min(accountAgeDays / 365, 10) * 1; // up to 10 points for 10yr+ accounts
  const recentActivityBonus = hasRecentActivity ? 10 : 0;

  const raw = followerScore + starScore + repoScore + ageScore + recentActivityBonus;
  // Clamp to a clean 0-100 scale. Without this, extreme outliers (e.g.
  // accounts with hundreds of thousands of followers/stars) can exceed
  // 100, which breaks the "score out of 100" mental model for consumers
  // of this API.
  return Math.round(Math.min(raw, 100) * 100) / 100;
}

function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}
