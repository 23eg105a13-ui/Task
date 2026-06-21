import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database';
import {
  GitHubUserResponse,
  GitHubRepoResponse,
  ComputedInsights,
  ProfileRecord,
  RepositoryRecord,
} from '../models/types';

export interface UpsertProfileParams {
  user: GitHubUserResponse;
  insights: ComputedInsights;
}

export interface ListProfilesParams {
  page: number;
  limit: number;
  sortBy: 'followers_count' | 'activity_score' | 'public_repos_count' | 'analyzed_at';
  order: 'ASC' | 'DESC';
  search?: string;
}

export interface ListProfilesResult {
  data: ProfileRecord[];
  total: number;
}

class ProfileRepository {
  /**
   * Inserts a new profile or updates the existing one (matched by
   * GitHub's numeric user id, which never changes even if the user
   * renames their account). Also logs a snapshot into analysis_runs.
   */
  async upsertProfile({ user, insights }: UpsertProfileParams): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const topLanguagesJson = JSON.stringify(insights.topLanguages);

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO profiles (
          github_id, username, name, avatar_url, bio, company, location, blog,
          twitter_username, email, hireable,
          public_repos_count, public_gists_count, followers_count, following_count,
          total_stars_received, total_forks_received, total_watchers_received,
          most_used_language, top_languages_json,
          most_starred_repo_name, most_starred_repo_stars,
          account_age_days, activity_score, has_recent_activity, last_repo_pushed_at,
          github_created_at, github_updated_at, analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          name = VALUES(name),
          avatar_url = VALUES(avatar_url),
          bio = VALUES(bio),
          company = VALUES(company),
          location = VALUES(location),
          blog = VALUES(blog),
          twitter_username = VALUES(twitter_username),
          email = VALUES(email),
          hireable = VALUES(hireable),
          public_repos_count = VALUES(public_repos_count),
          public_gists_count = VALUES(public_gists_count),
          followers_count = VALUES(followers_count),
          following_count = VALUES(following_count),
          total_stars_received = VALUES(total_stars_received),
          total_forks_received = VALUES(total_forks_received),
          total_watchers_received = VALUES(total_watchers_received),
          most_used_language = VALUES(most_used_language),
          top_languages_json = VALUES(top_languages_json),
          most_starred_repo_name = VALUES(most_starred_repo_name),
          most_starred_repo_stars = VALUES(most_starred_repo_stars),
          account_age_days = VALUES(account_age_days),
          activity_score = VALUES(activity_score),
          has_recent_activity = VALUES(has_recent_activity),
          last_repo_pushed_at = VALUES(last_repo_pushed_at),
          github_updated_at = VALUES(github_updated_at),
          analyzed_at = NOW()`,
        [
          user.id,
          user.login,
          user.name,
          user.avatar_url,
          user.bio,
          user.company,
          user.location,
          user.blog,
          user.twitter_username,
          user.email,
          user.hireable,
          user.public_repos,
          user.public_gists,
          user.followers,
          user.following,
          insights.totalStarsReceived,
          insights.totalForksReceived,
          insights.totalWatchersReceived,
          insights.mostUsedLanguage,
          topLanguagesJson,
          insights.mostStarredRepoName,
          insights.mostStarredRepoStars,
          insights.accountAgeDays,
          insights.activityScore,
          insights.hasRecentActivity,
          insights.lastRepoPushedAt ? new Date(insights.lastRepoPushedAt) : null,
          new Date(user.created_at),
          new Date(user.updated_at),
        ]
      );

      // Resolve the profile id whether this was an INSERT or an UPDATE.
      let profileId: number;
      if (result.insertId) {
        profileId = result.insertId;
      } else {
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM profiles WHERE github_id = ? LIMIT 1',
          [user.id]
        );
        profileId = rows[0].id as number;
      }

      // Append a historical snapshot for trend tracking.
      await connection.execute(
        `INSERT INTO analysis_runs
          (profile_id, public_repos_count, followers_count, following_count, total_stars_received, activity_score)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          user.public_repos,
          user.followers,
          user.following,
          insights.totalStarsReceived,
          insights.activityScore,
        ]
      );

      await connection.commit();
      return profileId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Replaces the stored top-repositories snapshot for a profile.
   * Called after upsertProfile with the top N repos by star count.
   */
  async replaceRepositories(profileId: number, repos: GitHubRepoResponse[]): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute('DELETE FROM repositories WHERE profile_id = ?', [profileId]);

      if (repos.length > 0) {
        const values = repos.map((r) => [
          profileId,
          r.name,
          r.full_name,
          r.description,
          r.language,
          r.stargazers_count,
          r.forks_count,
          r.watchers_count,
          r.fork,
          r.html_url,
          r.pushed_at ? new Date(r.pushed_at) : null,
        ]);

        await connection.query(
          `INSERT INTO repositories
            (profile_id, repo_name, repo_full_name, description, language,
             stars_count, forks_count, watchers_count, is_fork, html_url, repo_pushed_at)
           VALUES ?`,
          [values]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findByUsername(username: string): Promise<ProfileRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM profiles WHERE username = ? LIMIT 1',
      [username]
    );
    return (rows[0] as ProfileRecord) ?? null;
  }

  async getTopRepositories(profileId: number, limit = 5): Promise<RepositoryRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM repositories WHERE profile_id = ?
       ORDER BY stars_count DESC LIMIT ?`,
      [profileId, limit]
    );
    return rows as RepositoryRecord[];
  }

  async getAnalysisHistory(profileId: number, limit = 20): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT public_repos_count, followers_count, following_count,
              total_stars_received, activity_score, created_at
       FROM analysis_runs WHERE profile_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [profileId, limit]
    );
    return rows;
  }

  async list(params: ListProfilesParams): Promise<ListProfilesResult> {
    const { page, limit, sortBy, order, search } = params;
    const offset = (page - 1) * limit;

    const whereClause = search ? 'WHERE username LIKE ? OR name LIKE ?' : '';
    const searchParams = search ? [`%${search}%`, `%${search}%`] : [];

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM profiles ${whereClause}`,
      searchParams
    );
    const total = countRows[0].total as number;

    // sortBy/order are validated by the controller against an allow-list
    // before reaching here, so it's safe to interpolate them directly
    // (mysql2 cannot parameterize identifiers/keywords).
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM profiles ${whereClause}
       ORDER BY ${sortBy} ${order}
       LIMIT ? OFFSET ?`,
      [...searchParams, limit, offset]
    );

    return { data: rows as ProfileRecord[], total };
  }

  async deleteByUsername(username: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM profiles WHERE username = ?',
      [username]
    );
    return result.affectedRows > 0;
  }

  async getAggregateStats(): Promise<RowDataPacket> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total_profiles,
        SUM(public_repos_count) as total_repos_analyzed,
        SUM(followers_count) as total_followers_combined,
        SUM(total_stars_received) as total_stars_combined,
        AVG(activity_score) as avg_activity_score
       FROM profiles`
    );
    return rows[0];
  }
}

export const profileRepository = new ProfileRepository();
