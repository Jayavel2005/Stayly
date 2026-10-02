import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ModerateReviewDto {
  @ApiProperty({
    description:
      'Whether the review is publicly visible or concealed by administrative moderation.',
    example: false,
  })
  @IsBoolean()
  isPublished: boolean;
}
