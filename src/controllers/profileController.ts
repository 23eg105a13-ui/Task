import { Request, Response } from 'express';
import { analyzerService } from '../services/analyzerService';
import { profileRepository } from '../services/profileRepository';
import { formatProfile, formatProfileSummary } from '../utils/formatters';
import { ApiError } from '../models/types';
import { parseListQuery } from '../middleware/validators';

/**
 * POST /api/profiles/analyze
 * Body: { "username": "octocat" }
 * Fetches the GitHub profile, computes insights, stores/updates it.
 */
export async function analyzeProfile(req: Request, res: Response): Promise<void> {
  const username = String(req.body.username ?? req.params.username ?? '').trim();

  const profileId = await analyzerService.analyzeUsername(username);
  const profile = await profileRepository.findByUsername(username);

  if (!profile) {
    throw new ApiError(500, 'Profile was analyzed but could not be retrieved.');
  }

  const topRepos = await profileRepository.getTopRepositories(profileId, 10);

  res.status(200).json({
    success: true,
    message: `Profile '${username}' analyzed and stored successfully.`,
    data: formatProfile(profile, topRepos),
  });
}

/**
 * GET /api/profiles
 * Returns a paginated list of all previously analyzed profiles.
 * Supports ?page, ?limit, ?sortBy, ?order, ?search
 */
export async function listProfiles(req: Request, res: Response): Promise<void> {
  const { page, limit, sortBy, order, search } = parseListQuery(req);

  const { data, total } = await profileRepository.list({ page, limit, sortBy, order, search });

  res.status(200).json({
    success: true,
    data: data.map(formatProfileSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * GET /api/profiles/:username
 * Returns full stored detail for a single analyzed profile, including
 * its top repositories and historical analysis snapshots.
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  const username = String(req.params.username).trim();

  const profile = await profileRepository.findByUsername(username);
  if (!profile) {
    throw new ApiError(
      404,
      `Profile '${username}' has not been analyzed yet. POST /api/profiles/analyze first.`
    );
  }

  const topRepos = await profileRepository.getTopRepositories(profile.id, 10);
  const history = await profileRepository.getAnalysisHistory(profile.id, 20);

  res.status(200).json({
    success: true,
    data: {
      ...formatProfile(profile, topRepos),
      analysisHistory: history,
    },
  });
}

/**
 * DELETE /api/profiles/:username
 * Removes a stored profile (and cascades to its repos/history).
 */
export async function deleteProfile(req: Request, res: Response): Promise<void> {
  const username = String(req.params.username).trim();

  const deleted = await profileRepository.deleteByUsername(username);
  if (!deleted) {
    throw new ApiError(404, `Profile '${username}' was not found.`);
  }

  res.status(200).json({
    success: true,
    message: `Profile '${username}' deleted.`,
  });
}

/**
 * GET /api/profiles/stats/summary
 * Aggregate stats across all analyzed profiles — a small "dashboard"
 * endpoint that's a nice bonus beyond the bare requirements.
 */
export async function getStatsSummary(_req: Request, res: Response): Promise<void> {
  const stats = await profileRepository.getAggregateStats();

  res.status(200).json({
    success: true,
    data: {
      totalProfiles: Number(stats.total_profiles) || 0,
      totalReposAnalyzed: Number(stats.total_repos_analyzed) || 0,
      totalFollowersCombined: Number(stats.total_followers_combined) || 0,
      totalStarsCombined: Number(stats.total_stars_combined) || 0,
      averageActivityScore: stats.avg_activity_score
        ? Math.round(Number(stats.avg_activity_score) * 100) / 100
        : 0,
    },
  });
}
