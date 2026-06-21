import { githubService } from './githubService';
import { computeInsights } from './insightsService';
import { profileRepository } from './profileRepository';
import { cacheService } from './cacheService';
import { ApiError } from '../models/types';

const TOP_REPOS_TO_STORE = 10;
const CACHE_PREFIX = 'analysis:';

class AnalyzerService {
  /**
   * Full pipeline: fetch from GitHub -> compute insights -> persist to MySQL.
   * Returns the resulting profile id so the controller can re-fetch
   * the freshly-stored record in a consistent shape.
   */
  async analyzeUsername(username: string): Promise<number> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      throw new ApiError(400, 'Username must not be empty.');
    }

    const cacheKey = `${CACHE_PREFIX}${normalizedUsername.toLowerCase()}`;
    const cachedProfileId = cacheService.get<number>(cacheKey);
    if (cachedProfileId) {
      return cachedProfileId;
    }

    const [user, repos] = await Promise.all([
      githubService.fetchUser(normalizedUsername),
      githubService.fetchAllRepos(normalizedUsername),
    ]);

    const insights = computeInsights(user, repos);
    const profileId = await profileRepository.upsertProfile({ user, insights });

    const topRepos = [...repos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, TOP_REPOS_TO_STORE);
    await profileRepository.replaceRepositories(profileId, topRepos);

    cacheService.set(cacheKey, profileId);

    return profileId;
  }
}

export const analyzerService = new AnalyzerService();
