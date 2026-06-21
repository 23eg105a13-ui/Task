import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../models/types';

const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;

export function validateUsername(req: Request, _res: Response, next: NextFunction): void {
  const username = (req.params.username || req.body?.username || '').trim();

  if (!username) {
    return next(new ApiError(400, 'A GitHub username is required.'));
  }
  if (!USERNAME_REGEX.test(username)) {
    return next(
      new ApiError(
        400,
        'Invalid GitHub username format. Usernames may only contain alphanumeric characters and hyphens, and cannot start with a hyphen.'
      )
    );
  }

  next();
}

const ALLOWED_SORT_FIELDS = [
  'followers_count',
  'activity_score',
  'public_repos_count',
  'analyzed_at',
] as const;
type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];

export interface ParsedListQuery {
  page: number;
  limit: number;
  sortBy: AllowedSortField;
  order: 'ASC' | 'DESC';
  search?: string;
}

export function parseListQuery(req: Request): ParsedListQuery {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limitRaw = parseInt(String(req.query.limit ?? '10'), 10) || 10;
  const limit = Math.min(Math.max(1, limitRaw), 100); // cap at 100 per page

  const sortByRaw = String(req.query.sortBy ?? 'analyzed_at');
  const sortBy: AllowedSortField = ALLOWED_SORT_FIELDS.includes(sortByRaw as AllowedSortField)
    ? (sortByRaw as AllowedSortField)
    : 'analyzed_at';

  const orderRaw = String(req.query.order ?? 'DESC').toUpperCase();
  const order: 'ASC' | 'DESC' = orderRaw === 'ASC' ? 'ASC' : 'DESC';

  const search = req.query.search ? String(req.query.search).trim() : undefined;

  return { page, limit, sortBy, order, search };
}
