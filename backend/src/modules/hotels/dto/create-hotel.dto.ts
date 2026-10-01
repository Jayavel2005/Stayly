import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateHotelDto {
  @ApiProperty({
    example: 'Stayora Heritage Grand',
    description: 'Name of the hotel property',
  })
  @IsString()
  @IsNotEmpty({ message: 'Hotel name is required' })
  @MinLength(2, { message: 'Hotel name must be at least 2 characters long' })
  @MaxLength(255, { message: 'Hotel name must not exceed 255 characters' })
  name!: string;

  @ApiPropertyOptional({
    example: 'stayora-heritage-grand',
    description: 'URL-friendly unique slug. Auto-generated from name if omitted.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @ApiProperty({
    example:
      'A luxury heritage estate offering panoramic ocean views and royal dining.',
    description: 'Full description of the hotel property',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description!: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Star rating from 1 to 5',
    default: 3,
  })
  @IsInt({ message: 'Star rating must be an integer' })
  @Min(1, { message: 'Star rating must be at least 1' })
  @Max(5, { message: 'Star rating cannot exceed 5' })
  @IsOptional()
  starRating?: number = 3;

  @ApiProperty({
    example: '100 Beach Boulevard, Colaba',
    description: 'Primary street address line',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address line 1 is required' })
  @MaxLength(255)
  addressLine1!: string;

  @ApiPropertyOptional({
    example: 'Near Gateway of India',
    description: 'Secondary address or landmark',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  addressLine2?: string;

  @ApiProperty({
    example: 'Mumbai',
    description: 'City where property is located',
  })
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MaxLength(100)
  city!: string;

  @ApiProperty({
    example: 'Maharashtra',
    description: 'State / Province / Region',
  })
  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  @MaxLength(100)
  state!: string;

  @ApiProperty({
    example: 'India',
    description: 'Country',
  })
  @IsString()
  @IsNotEmpty({ message: 'Country is required' })
  @MaxLength(100)
  country!: string;

  @ApiProperty({
    example: '400001',
    description: 'Postal / ZIP code',
  })
  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  @MaxLength(20)
  postalCode!: string;

  @ApiPropertyOptional({
    example: 18.922,
    description: 'GPS Latitude coordinate (-90 to 90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    example: 72.8347,
    description: 'GPS Longitude coordinate (-180 to 180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    example: '+912266653300',
    description: 'Property direct telephone number',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @MaxLength(30)
  phone!: string;

  @ApiProperty({
    example: 'concierge.grand@stayora.com',
    description: 'Official contact email',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail({}, { message: 'Invalid email address format' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'Standard check-in time (HH:mm)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Check-in time must be in HH:mm or HH:mm:ss format',
  })
  checkInTime?: string;

  @ApiPropertyOptional({
    example: '11:00',
    description: 'Standard check-out time (HH:mm)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Check-out time must be in HH:mm or HH:mm:ss format',
  })
  checkOutTime?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the hotel is active and available for bookings',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    description:
      'Optional UUID of an initial hotel manager to assign upon creation (ADMIN only)',
  })
  @IsUUID('4', { message: 'Initial manager ID must be a valid UUID' })
  @IsOptional()
  initialManagerId?: string;
}
