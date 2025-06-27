import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (user && (await bcrypt.compare(password, user.password))) {
        const { password: userPassword, ...result } = user;
        return result;
      }
      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error validating user:', errorMessage);
      return null;
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    try {
      // Check if user already exists
      const existingUser = await this.usersService.findByEmail(
        registerDto.email,
      );
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const existingUsername = await this.usersService.findByUsername(
        registerDto.username,
      );
      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        saltRounds,
      );

      // Create user
      const user = await this.usersService.create({
        ...registerDto,
        password: hashedPassword,
      });

      // Generate JWT token
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(payload);

      this.logger.log(`New user registered: ${user.email}`);

      return {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error registering user:', errorMessage);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Registration failed');
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
