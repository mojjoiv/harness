import { BadRequestException } from '@nestjs/common';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sort: string;
  order: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export function getPagination(query: PaginationQueryDto, allowedSorts: string[] = ['createdAt']) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const sort = query.sort || 'createdAt';
  const order = query.order || 'desc';

  if (!allowedSorts.includes(sort)) {
    throw new BadRequestException(`Unsupported sort field: ${sort}`);
  }

  return {
    page,
    limit,
    sort,
    order,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function paginated<T>(
  items: T[],
  total: number,
  pagination: ReturnType<typeof getPagination>,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
      sort: pagination.sort,
      order: pagination.order,
    },
  };
}
