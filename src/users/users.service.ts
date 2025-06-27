import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';

// Define User type from Prisma
type User = Prisma.UserGetPayload<{}>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          username: createUserDto.username,
          password: createUserDto.password,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
        },
      });

      this.logger.log(`User created with ID: ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = (error.meta?.target as string[])?.join(', ') || 'field';
          throw new ConflictException(`User with this ${field} already exists`);
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error creating user:', errorMessage);
      throw error;
    }
  }

  async findAll(skip: number = 0, take: number = 10): Promise<User[]> {
    try {
      const users = await this.prisma.user.findMany({
        skip,
        take,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return users as User[];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error fetching users:', errorMessage);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          posts: {
            select: {
              id: true,
              title: true,
              published: true,
              createdAt: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error finding user with ID ${id}:`, errorMessage);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      return user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error finding user with email ${email}:`,
        errorMessage,
      );
      return null;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      return user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error finding user with username ${username}:`,
        errorMessage,
      );
      return null;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateUserDto,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`User updated with ID: ${id}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const field = (error.meta?.target as string[])?.join(', ') || 'field';
          throw new ConflictException(`User with this ${field} already exists`);
        }
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error updating user with ID ${id}:`, errorMessage);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User deleted with ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting user with ID ${id}:`, errorMessage);
      throw error;
    }
  }

  async deactivate(id: string): Promise<User> {
    return this.update(id, { isActive: false });
  }

  async activate(id: string): Promise<User> {
    return this.update(id, { isActive: true });
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.user.count();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error counting users:', errorMessage);
      throw error;
    }
  }
}
