import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    validateUser(identifier: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: any;
    }>;
    signup(data: {
        email?: string;
        phoneNumber?: string;
        password: string;
        username?: string;
        currency?: string;
        bonus_id?: string;
    }): Promise<{
        access_token: string;
        user: any;
    }>;
}
