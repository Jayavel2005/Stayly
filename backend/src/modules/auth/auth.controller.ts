import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { ManagerLoginDto } from './dto/manager-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import type { AuthResponse, SafeUser } from './types/auth-response.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('customer/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Public Customer Registration',
    description:
      'Creates a new customer account. Enforces role = CUSTOMER. Rejects duplicate emails and unauthorized role parameters.',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer registered successfully. Returns user profile and JWT.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (malformed email, short password, non-whitelisted fields).',
  })
  @ApiResponse({
    status: 409,
    description: 'Email is already registered.',
  })
  async registerCustomer(
    @Body() dto: CustomerRegisterDto,
  ): Promise<AuthResponse> {
    return this.authService.registerCustomer(dto);
  }

  @Post('customer/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer Web Login (localhost:3000)',
    description:
      'Authenticates customer users. Rejects manager or admin accounts from using the customer portal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile and JWT.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password.',
  })
  @ApiResponse({
    status: 403,
    description: 'Incompatible role or account suspended.',
  })
  async loginCustomer(@Body() dto: CustomerLoginDto): Promise<AuthResponse> {
    return this.authService.loginCustomer(dto);
  }

  @Post('manager/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manager Web Login (localhost:3001)',
    description:
      'Authenticates hotel managers. Rejects customer or admin accounts from using the manager portal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile and JWT.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password.',
  })
  @ApiResponse({
    status: 403,
    description: 'Incompatible role or account suspended.',
  })
  async loginManager(@Body() dto: ManagerLoginDto): Promise<AuthResponse> {
    return this.authService.loginManager(dto);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin Web Login (localhost:3002)',
    description:
      'Authenticates system administrators. Rejects customer or manager accounts from using the admin portal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile and JWT.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password.',
  })
  @ApiResponse({
    status: 403,
    description: 'Incompatible role or account suspended.',
  })
  async loginAdmin(@Body() dto: AdminLoginDto): Promise<AuthResponse> {
    return this.authService.loginAdmin(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get Current Authenticated User Profile',
    description:
      'Returns the sanitized profile for the authenticated user extracted from the verified JWT. Never exposes credentials.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user profile retrieved.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or missing Bearer token.',
  })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.getCurrentUser(user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User Logout',
    description:
      'Stateless logout confirmation. Directs client applications to discard local JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out.',
  })
  async logout(): Promise<{ message: string }> {
    return this.authService.logout();
  }
}
