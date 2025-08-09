import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

import { User, UserRole, UserStatus } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ResetToken } from './entities/reset-token.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../services/mail.service';
import { RegisterDeliveryStaffDto } from './dto/register-delivery.dto';
import { DeliveryStaff } from './entities/delivery-staff.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,

    @InjectRepository(ResetToken)
    private resetTokenRepository: Repository<ResetToken>,

    @InjectRepository(DeliveryStaff)
    private deliveryStaffRepository: Repository<DeliveryStaff>,

    private jwtService: JwtService,
    private mailService: MailService,
      private configService: ConfigService,
  ) { }

  async signup(signupData: SignupDto) {
    const { email, password, name, role, phone } = signupData;

    const emailInUse = await this.userRepository.findOne({
      where: { email },
    });
    if (emailInUse) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let status = UserStatus.ACTIVE;
    if (role === UserRole.DELIVERY_STAFF || role === UserRole.STAFF) {
      status = UserStatus.PENDING_APPROVAL;
    }

    const user = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      role,
      status,
      phone,
    });

    await this.userRepository.save(user);

    let message = 'User created successfully'; 
    if (status === UserStatus.PENDING_APPROVAL) {
      message = 'Account created successfully. Pending admin approval.';
    }

    return {
      message,
      userId: user.id,
      role: user.role,
      status: user.status,
    };
  }

 async registerDeliveryStaff(dto: RegisterDeliveryStaffDto) {
  const existingUser = await this.userRepository.findOne({
    where: { email: dto.email },
  });

  if (existingUser) {
    throw new BadRequestException('Email is already registered');
  }

  const hashedPassword = await bcrypt.hash(dto.password, 10);

  const user = this.userRepository.create({
    email: dto.email,
    password: hashedPassword,
    role: UserRole.DELIVERY_STAFF,
    status: UserStatus.PENDING_APPROVAL,
    phone: dto.phone,
    name: `${dto.firstName} ${dto.lastName}`,
  });

  try {
    await this.userRepository.save(user);

    const deliveryStaff = this.deliveryStaffRepository.create({
      user,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      address: dto.address,
      vehicleType: dto.vehicleType,
      licenseNumber: dto.licenseNumber,
      selfieUrl: dto.selfieUrl,
      nationalIdFrontUrl: dto.nationalIdFrontUrl,
      nationalIdBackUrl: dto.nationalIdBackUrl,
      isVerified: false,
      isActive: true,
    });

    await this.deliveryStaffRepository.save(deliveryStaff);

  const adminEmail = this.configService.get('ADMIN_EMAIL') ?? 'admin@example.com';

if (!adminEmail) {
  throw new InternalServerErrorException('Admin email not configured');
}

await this.mailService.sendDeliveryStaffRegistrationEmails(adminEmail, {
  email: user.email,
  firstName: dto.firstName,
  lastName: dto.lastName,
  phone: dto.phone,
  vehicleType: dto.vehicleType,
  licenseNumber: dto.licenseNumber,
  selfieUrl: '',
  nationalIdFrontUrl: '',
  nationalIdBackUrl: ''
});


    return {
      status: 'pending_review',
      message:
        'Registration successful. You will receive an email notification at your registered email after admin review.',
      userId: user.id,
    };
  } catch (error) {
    throw new InternalServerErrorException('Failed to register delivery staff');
  }
}


  async login(credentials: LoginDto) {
    const { email, password } = credentials;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Wrong credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account has been suspended');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }
    if (user.status === UserStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Account is pending approval');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Wrong credentials');
    }

    const tokens = await this.generateUserTokens(user.id);
    return {
      ...tokens,
      userId: user.id,
      role: user.role,
      status: user.status,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found...');
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Wrong credentials');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = newHashedPassword;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      const resetToken = nanoid(64);
      const resetTokenEntity = this.resetTokenRepository.create({
        token: resetToken,
        userId: user.id,
        expiryDate,
      });

      await this.resetTokenRepository.save(resetTokenEntity);

      await this.mailService.sendPasswordResetEmail(email, resetToken);
    }

    return { message: 'If this user exists, they will receive an email' };
  }

  async resetPassword(newPassword: string, resetToken: string) {
    const token = await this.resetTokenRepository.findOne({
      where: {
        token: resetToken,
        expiryDate: MoreThan(new Date()),
      },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid link');
    }

    await this.resetTokenRepository.remove(token);

    const user = await this.userRepository.findOne({ where: { id: token.userId } });
    if (!user) {
      throw new InternalServerErrorException();
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password reset successfully' };
  }

  async refreshTokens(refreshToken: string) {
    const token = await this.refreshTokenRepository.findOne({
      where: {
        token: refreshToken,
        expiryDate: MoreThan(new Date()),
      },
    });

    if (!token) {
      throw new UnauthorizedException('Refresh Token is invalid');
    }

    return this.generateUserTokens(token.userId);
  }

  async generateUserTokens(userId: string) {
    const accessToken = this.jwtService.sign({ userId }, { expiresIn: '10h' });
    const refreshToken = uuidv4();

    await this.storeRefreshToken(refreshToken, userId);
    return {
      accessToken,
      refreshToken,
    };
  }

  async storeRefreshToken(token: string, userId: string) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

    const existingToken = await this.refreshTokenRepository.findOne({
      where: { userId },
    });

    if (existingToken) {
      existingToken.token = token;
      existingToken.expiryDate = expiryDate;
      await this.refreshTokenRepository.save(existingToken);
    } else {
      const refreshTokenEntity = this.refreshTokenRepository.create({
        token,
        userId,
        expiryDate,
      });
      await this.refreshTokenRepository.save(refreshTokenEntity);
    }
  }

  async getUserProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role', 'status', 'phone', 'isEmailVerified', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(adminUserId: string, targetUserEmail: string, status: UserStatus) {
    const adminUser = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update user status');
    }

    const targetUser = await this.userRepository.findOne({ where: { email: targetUserEmail } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    targetUser.status = status;
    await this.userRepository.save(targetUser);

    return { message: 'User status updated successfully', user: targetUser };
  }

  async getPendingUsers(adminUserId: string) {
    const adminUser = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view pending users');
    }

    const pendingUsers = await this.userRepository.find({
      where: { status: UserStatus.PENDING_APPROVAL },
      select: ['id', 'name', 'email', 'role', 'phone', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    return pendingUsers;
  }

  async getAllUsers(adminUserId: string) {
    const adminUser = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view all users');
    }

    const users = await this.userRepository.find({
      select: ['id', 'name', 'email', 'role', 'status', 'phone', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    return users;
  }

  async getUsersByRole(adminUserId: string, role: UserRole) {
    const adminUser = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view users by role');
    }

    const users = await this.userRepository.find({
      where: { role },
      select: ['id', 'name', 'email', 'role', 'status', 'phone', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    return users;
  }
}
