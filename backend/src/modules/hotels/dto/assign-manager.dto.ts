import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AssignManagerDto {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'UUID of the user with HOTEL_MANAGER role to assign',
  })
  @IsUUID('4', { message: 'managerId must be a valid UUID' })
  @IsNotEmpty({ message: 'managerId is required' })
  managerId!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Designate as the primary property manager',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;
}
