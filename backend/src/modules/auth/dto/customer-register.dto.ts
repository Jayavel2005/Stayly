import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CustomerRegisterDto {
  @ApiProperty({
    example: 'aarav.sharma@example.com',
    description: 'Customer email address',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Customer account password (minimum 8 characters)',
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @ApiPropertyOptional({
    example: 'Aarav Sharma',
    description: 'Full name (will be split into first and last name if provided)',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Aarav',
    description: 'First name',
  })
  @ValidateIf((o: CustomerRegisterDto) => !o.name)
  @IsString()
  @IsNotEmpty({ message: 'First name is required when full name is not provided' })
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Sharma',
    description: 'Last name',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Contact phone number',
  })
  @IsString()
  @IsOptional()
  phone?: string;
}
