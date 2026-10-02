import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminModerateReviewDto {
  @ApiProperty({ description: 'Whether the review is visible/published' })
  @IsBoolean()
  isPublished: boolean;

  @ApiPropertyOptional({
    description: 'Operational reason for moderating the review',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderationReason?: string;
}
