import { ApiProperty } from '@nestjs/swagger';

/**
 * Structured error payload mirrored from `common/types/api-response.ts`
 * but as a class so Swagger can render it and openapi-typescript-codegen
 * can emit a TS type.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 'NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Resource not found' })
  message!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Optional validation details / debug payload',
  })
  details?: unknown;
}

/**
 * Pagination metadata attached to list responses.
 */
export class ApiMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
