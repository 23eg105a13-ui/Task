import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/env';
import { ApiError, GitHubUserResponse, GitHubRepoResponse } from '../models/types';

class GitHubService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.github.apiBaseUrl,
      timeout: 10000,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(config.github.token ? { Authorization: `Bearer ${config.github.token}` } : {}),
      },
    });
  }

  /**
   * Fetches the public profile for a GitHub username.
   * Throws ApiError(404) if the user doesn't exist.
   */
  async fetchUser(username: string): Promise<GitHubUserResponse> {
    try {
      const { data } = await this.client.get<GitHubUserResponse>(`/users/${username}`);
      return data;
    } catch (error) {
      throw this.translateError(error, username);
    }
  }

  /**
   * Fetches up to `maxRepos` public repositories for a username,
   * sorted by most recently pushed, paginating through GitHub's API
   * (100 per page max) until exhausted or the cap is reached.
   */
  async fetchAllRepos(username: string, maxRepos = 300): Promise<GitHubRepoResponse[]> {
    const perPage = 100;
    let page = 1;
    const repos: GitHubRepoResponse[] = [];

    while (repos.length < maxRepos) {
      try {
        const { data } = await this.client.get<GitHubRepoResponse[]>(
          `/users/${username}/repos`,
          {
            params: {
              per_page: perPage,
              page,
              sort: 'pushed',
              direction: 'desc',
            },
          }
        );

        repos.push(...data);

        if (data.length < perPage) break; // last page reached
        page += 1;
      } catch (error) {
        throw this.translateError(error, username);
      }
    }

    return repos.slice(0, maxRepos);
  }

  private translateError(error: unknown, username: string): ApiError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (status === 404) {
        return new ApiError(404, `GitHub user '${username}' was not found.`);
      }
      if (status === 403) {
        return new ApiError(
          503,
          'GitHub API rate limit exceeded. Set a GITHUB_TOKEN to raise the limit, or try again later.'
        );
      }
      if (status) {
        return new ApiError(502, `GitHub API responded with status ${status}.`);
      }
      return new ApiError(502, 'Unable to reach the GitHub API. Please try again.');
    }
    return new ApiError(500, 'Unexpected error while contacting the GitHub API.');
  }
}

export const githubService = new GitHubService();
