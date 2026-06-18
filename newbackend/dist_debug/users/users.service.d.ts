import { PrismaService } from '../prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalance(username: string): Promise<{
        balance: number;
        exposure: number;
        bonus: number;
    } | null>;
    updateBalance(username: string, amount: number, type: 'credit' | 'debit' | 'set'): Promise<{
        id: number;
        email: string | null;
        phoneNumber: string | null;
        password: string;
        username: string | null;
        currency: string | null;
        bonus_id: string | null;
        balance: number;
        exposure: number;
        bonus: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findOne(username: string): Promise<{
        id: number;
        email: string | null;
        phoneNumber: string | null;
        password: string;
        username: string | null;
        currency: string | null;
        bonus_id: string | null;
        balance: number;
        exposure: number;
        bonus: number;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
