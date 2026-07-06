import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class UsageQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
