import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { EventsGateway } from '../events.gateway';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => EventsGateway))
        private eventsGateway: EventsGateway,
        private emailService: EmailService,
    ) { }

    async getBalance(username: string) {
        const user = await this.prisma.user.findUnique({
            where: { username },
            select: { balance: true, exposure: true, fiatBonus: true } as any,
        }) as any;

        if (!user) return null;

        return {
            balance: parseFloat(user.balance.toString()),
            exposure: parseFloat((user.exposure || 0).toString()),
            bonus: parseFloat((user.fiatBonus || 0).toString()),
            fiatBonus: parseFloat((user.fiatBonus || 0).toString()),
        };
    }

    async updateBalance(username: string, amount: number, type: 'credit' | 'debit' | 'set') {
        const user = await this.prisma.user.findUnique({ where: { username } });
        if (!user) throw new Error('User not found');

        let newBalance = parseFloat(user.balance.toString());
        if (type === 'credit') {
            newBalance += amount;
        } else if (type === 'debit') {
            newBalance -= amount;
        } else {
            newBalance = amount;
        }

        const updatedUser = await this.prisma.user.update({
            where: { username },
            data: { balance: newBalance },
        });

        // Emit socket event
        // Note: Ideally emit to specific user room if strict privacy needed, 
        // but frontend Header listens to 'balanceUpdate'.
        // If we broadcast 'balanceUpdate', ALL users get it? 
        // Wait, Header checks: `socket.on('balanceUpdate', ...)`
        // If we just emit to everyone, everyone gets updated with THIS user's balance? That's bad.
        // We should emit to a specific room or check userID on frontend.
        // Frontend code: `socket.on('balanceUpdate', (data) => setBalance(data.balance))`
        // It blindly sets balance. So we MUST emit ONLY to the specific user.
        // EventsGateway logic for privacy?
        // Assuming joined room `user_${userId}` or similar?
        // If not, we should emit event `balanceUpdate_${userId}` or check payload.
        // BUT, frontend is: `socket.on('balanceUpdate'...)`.
        // Let's modify frontend to check? Or use a room.
        // For now, let's emit with userId in payload and frontend handles?
        // OR better: check if we can emit to `to(socketId)`. We don't have socketId easily here.
        // Let's emit `balanceUpdate` but with `userId` in data.
        // And update Frontend to check? 
        // Actually, earlier prompt said: "Frontend listens for balanceUpdate".
        // Let's assume the user wants `this.eventsGateway.server.emit('balanceUpdate', ...)` based on existing patterns?
        // No, that's unsafe. 
        // Best approach given constraints: Emit globally but include userId, and frontend filters.
        // OR: `this.eventsGateway.server.to(String(user.id)).emit(...)` assuming they joined a room.
        // Let's try `to(String(user.id))` as it's best practice. If it fails (no room), no harm?

        // Actually, looking at `SportsMainContent`, we just `socket.on`.
        // Let's use `this.eventsGateway.server.emit('balanceUpdate', { userId: user.id, balance: newBalance })`
        // And I will update frontend `Header.tsx` to check userId if I can.
        // Wait, `Header.tsx` gets `user` from `useAuth`.

        this.eventsGateway.emitUserWalletUpdate(user.id, { balance: newBalance });

        return updatedUser;
    }

    async findOne(username: string) {
        return this.prisma.user.findUnique({ where: { username } });
    }

    async findOneById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            include: { manager: { select: { id: true, username: true } } }
        });
    }

    // ... (other methods)

    async updateBalanceById(userId: number, amount: number, type: 'credit' | 'debit' | 'set') {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        let newBalance = parseFloat(user.balance.toString());
        if (type === 'credit') {
            newBalance += amount;
        } else if (type === 'debit') {
            newBalance -= amount;
        } else {
            newBalance = amount;
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { balance: newBalance },
        });

        this.eventsGateway.emitUserWalletUpdate(user.id, { balance: newBalance });

        return updatedUser;
    }

    async getWallet(userId: number) {
        // Try full select (all columns incl. new bonus split fields).
        // If migration hasn't run yet those columns won't exist and Prisma throws.
        // In that case, fall back to the known-safe base columns.
        let user: any = null;
        try {
            user = await (this.prisma.user as any).findUnique({
                where: { id: userId },
                select: {
                    balance: true,
                    exposure: true,
                    currency: true,
                    cryptoBalance: true,
                    activeWallet: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                    casinoBonus: true,
                    sportsBonus: true,
                    wageringRequired: true,
                    wageringDone: true,
                    depositWageringRequired: true,
                    depositWageringDone: true,
                    casinoBonusWageringRequired: true,
                    casinoBonusWageringDone: true,
                    sportsBonusWageringRequired: true,
                    sportsBonusWageringDone: true,
                    totalDeposited: true,
                    totalWagered: true,
                },
            });
        } catch {
            // Migration not applied yet — fall back to base columns only
            user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    balance: true,
                    exposure: true,
                    currency: true,
                    cryptoBalance: true,
                    activeWallet: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                } as any,
            }) as any;
        }

        if (!user) return null;

        const mainWalletBalance = parseFloat((user.balance || 0).toString());
        const bonusWalletBalance = parseFloat((user.sportsBonus || 0).toString());
        const depositWageringRequired = parseFloat((user.depositWageringRequired || 0).toString());
        const depositWageringDone = parseFloat((user.depositWageringDone || 0).toString());

        return {
            // Fiat wallet
            fiatBalance: mainWalletBalance,
            fiatCurrency: user.currency || 'INR',
            exposure: parseFloat((user.exposure || 0).toString()),
            // Bonus wallets — legacy aggregate
            fiatBonus: parseFloat((user.fiatBonus || 0).toString()),
            cryptoBonus: parseFloat((user.cryptoBonus || 0).toString()),
            // Split bonus wallets (casino vs sports) — 0 until migration applied
            casinoBonus: parseFloat((user.casinoBonus || 0).toString()),
            sportsBonus: bonusWalletBalance,
            // Legacy bonus field for backward compat
            bonus: parseFloat(((user.casinoBonus || 0) + (user.sportsBonus || 0) + (user.fiatBonus || 0)).toString()),
            // Crypto main wallet (USD)
            cryptoBalance: parseFloat((user.cryptoBalance || 0).toString()),
            cryptoCurrency: 'USD',
            // Match cashback aliases
            mainWalletBalance,
            bonusWalletBalance,
            main_wallet_balance: mainWalletBalance,
            bonus_wallet_balance: bonusWalletBalance,
            // Active wallet preference
            activeWallet: user.activeWallet || 'fiat',
            // Deposit wagering lock
            depositWageringRequired,
            depositWageringDone,
            // Bonus wagering progress (global)
            bonusWageringRequired: parseFloat((user.wageringRequired || 0).toString()),
            bonusWageringDone: parseFloat((user.wageringDone || 0).toString()),
            // Per-type bonus wagering
            casinoBonusWageringRequired: parseFloat((user.casinoBonusWageringRequired || 0).toString()),
            casinoBonusWageringDone: parseFloat((user.casinoBonusWageringDone || 0).toString()),
            sportsBonusWageringRequired: parseFloat((user.sportsBonusWageringRequired || 0).toString()),
            sportsBonusWageringDone: parseFloat((user.sportsBonusWageringDone || 0).toString()),
            // Legacy fields
            balance: mainWalletBalance,
            currency: user.currency,
        };
    }


    async getCasinoTransactions(userId: number, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        // Filter: skip zero-amount rows and pure UPDATE (balance-sync) events
        const where: any = {
            user_id: userId,
            amount: { gt: 0 },
            NOT: { type: 'UPDATE' },
        };

        const [transactions, total] = await Promise.all([
            this.prisma.casinoTransaction.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.casinoTransaction.count({ where }),
        ]);

        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async updateUsername(userId: number, newUsername: string): Promise<{ success: boolean; username?: string; error?: string }> {
        const trimmed = newUsername?.trim();
        if (!trimmed) return { success: false, error: 'Username is required.' };
        if (trimmed.length < 3 || trimmed.length > 20) return { success: false, error: 'Username must be 3–20 characters.' };
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return { success: false, error: 'Only letters, numbers, and underscores allowed.' };

        const existing = await this.prisma.user.findUnique({ where: { username: trimmed } });
        if (existing && existing.id !== userId) return { success: false, error: 'This username is already taken.' };

        await this.prisma.user.update({ where: { id: userId }, data: { username: trimmed } });
        return { success: true, username: trimmed };
    }

    async updateProfile(userId: number, profileData: { firstName?: string; lastName?: string; country?: string; city?: string }): Promise<{ success: boolean; error?: string }> {
        const { firstName, lastName, country, city } = profileData;
        if (!firstName?.trim() || !lastName?.trim() || !country?.trim() || !city?.trim()) {
            return { success: false, error: 'All fields (Name, Surname, Country, City) are required.' };
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { 
                firstName: firstName.trim(), 
                lastName: lastName.trim(), 
                country: country.trim(), 
                city: city.trim() 
            } as any
        });
        
        return { success: true };
    }

    async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
        if (!currentPassword || !newPassword) return { success: false, error: 'All fields are required.' };
        if (newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters.' };

        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
        if (!user) return { success: false, error: 'User not found.' };

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return { success: false, error: 'Current password is incorrect.' };

        const hashed = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
        return { success: true };
    }

    async findAll(page: number, limit: number, search?: string, role?: string) {
        const skip = (page - 1) * limit;
        const where: any = {};

        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (role && role !== 'ALL') {
            // Cast to any to avoid type issues if Role enum isn't fully propagated in IDE context yet
            where.role = role as any;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                // Exclude password
                select: {
                    id: true,
                    username: true,
                    email: true,
                    phoneNumber: true,
                    role: true,
                    balance: true,
                    exposure: true,
                    fiatBonus: true,
                    cryptoBonus: true,
                    currency: true,
                    createdAt: true,
                    updatedAt: true,
                } as any
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async create(data: any) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return this.prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
                balance: data.balance || 0,
            }
        });
    }

    async update(id: number, data: any) {
        const updated = await this.prisma.user.update({
            where: { id },
            data,
        });

        if (data.isBanned === true && updated.email) {
            this.emailService
                .sendAccountSuspended(updated.email, updated.username, data.banReason || 'Policy violation')
                .catch((err) => console.error(`Failed to send suspension email to user ${id}`, err));
        }

        return updated;
    }

    async remove(id: number) {
        return this.prisma.user.delete({
            where: { id },
        });
    }

    async getManagers() {
        return this.prisma.user.findMany({
            where: { role: 'MANAGER' }, // Assuming 'MANAGER' is the correct enum value
            select: { id: true, username: true }
        });
    }

    async assignManager(userId: number, managerId: number) {
        // Verify manager exists and has correct role
        const manager = await this.prisma.user.findUnique({ where: { id: managerId } });
        if (!manager) throw new Error('Manager not found');
        // if (manager.role !== 'MANAGER') throw new Error('Selected user is not a manager'); // Optional check

        return this.prisma.user.update({
            where: { id: userId },
            data: { managerId } as any // Type cast if relation issue exists
        });
    }

    async addFunds(
        userId: number,
        amount: number,
        type: 'credit' | 'debit',
        adminId: number,
        wallet: 'fiat' | 'crypto' = 'fiat',
    ) {
        if (amount <= 0) throw new Error('Amount must be positive');

        const isCrypto = wallet === 'crypto';
        const delta = type === 'credit' ? { increment: amount } : { decrement: amount };

        return this.prisma.$transaction(async (prisma) => {
            // 1. Update User Balance — fiat vs crypto wallet routed by `wallet`
            const user = await prisma.user.update({
                where: { id: userId },
                data: isCrypto ? { cryptoBalance: delta } : { balance: delta },
            });

            // 2. Create Transaction Record
            await prisma.transaction.create({
                data: {
                    userId,
                    amount,
                    type: type === 'credit' ? 'ADMIN_DEPOSIT' : 'ADMIN_WITHDRAWAL',
                    status: 'COMPLETED',
                    paymentMethod: isCrypto ? 'MANUAL_CRYPTO' : 'MANUAL',
                    remarks: `Manual ${type} by Admin/Manager ID: ${adminId} (${isCrypto ? 'crypto' : 'fiat'} wallet)`,
                    adminId,
                    paymentDetails: {
                        source: 'ADMIN_ADD_FUNDS',
                        wallet: isCrypto ? 'crypto' : 'fiat',
                        currency: isCrypto ? 'USD' : 'INR',
                    } as any,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            return user;
        }).then(user => {
            // Emit socket event after successful transaction
            this.eventsGateway.emitUserWalletUpdate(user.id, {
                balance: parseFloat(user.balance.toString()),
                cryptoBalance: parseFloat((user as any).cryptoBalance?.toString?.() ?? '0'),
            });
            return user;
        });
    }

    // KYC & Responsible Gambling
    async uploadKycDocument(userId: number, type: string, url: string) {
        return this.prisma.kycDocument.create({
            data: {
                userId,
                type,
                url,
                status: 'PENDING'
            }
        });
    }

    async updateKycStatus(userId: number, status: 'VERIFIED' | 'REJECTED' | 'PENDING', reason?: string) {
        // Update user status
        await this.prisma.user.update({
            where: { id: userId },
            data: { kycStatus: status } as any
        });

        // If rejecting, maybe reject all pending docs? Or just leave them.
        // For now simplest approach.
        return { message: 'KYC Status Updated' };
    }

    async updateKycDocumentStatus(docId: number, status: 'VERIFIED' | 'REJECTED', reason?: string) {
        return this.prisma.kycDocument.update({
            where: { id: docId },
            data: { status, reason } as any
        });
    }

    async setResponsibleGamblingLimits(userId: number, limits: { depositLimit?: number, lossLimit?: number, selfExclusionUntil?: Date }) {
        return this.prisma.user.update({
            where: { id: userId },
            data: limits
        });
    }

    async bulkAction(userIds: number[], action: 'BAN' | 'VERIFY' | 'BONUS' | 'DELETE', data?: any) {
        if (!userIds.length) return { count: 0 };

        if (action === 'BAN') {
            const result = await this.prisma.user.updateMany({
                where: { id: { in: userIds } },
                data: { isBanned: true },
            });

            // Send suspension email to each banned user (fire-and-forget)
            const users = await this.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { email: true, username: true },
            });
            const reason = data?.reason || 'Policy violation';
            for (const user of users) {
                if (user.email) {
                    this.emailService
                        .sendAccountSuspended(user.email, user.username, reason)
                        .catch((err) => console.error(`Failed to send suspension email to ${user.email}`, err));
                }
            }

            return result;
        }

        if (action === 'VERIFY') {
            return this.prisma.user.updateMany({
                where: { id: { in: userIds } },
                data: { kycStatus: 'VERIFIED' }
            });
        }

        if (action === 'BONUS') {
            const amount = parseFloat(data?.amount || '0');
            if (amount <= 0) throw new Error("Invalid bonus amount");

            const results = [];
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            for (const uid of userIds) {
                try {
                    await (this.prisma as any).$transaction([
                        // Credit the casino bonus wallet (split-wallet field, not legacy fiatBonus)
                        (this.prisma as any).user.update({
                            where: { id: uid },
                            data: { casinoBonus: { increment: amount } }
                        }),
                        // Create a UserBonus record so the bonus shows in the user's My Bonuses panel
                        (this.prisma as any).userBonus.create({
                            data: {
                                userId: uid,
                                bonusId: 'admin_bulk',
                                bonusCode: 'ADMIN_BULK',
                                bonusTitle: 'Admin Bonus Credit',
                                bonusCurrency: 'INR',
                                applicableTo: 'CASINO',
                                depositAmount: 0,
                                bonusAmount: amount,
                                wageringRequired: 0,
                                wageringDone: 0,
                                status: 'ACTIVE',
                                expiresAt,
                            }
                        }),
                        // Transaction log entry
                        (this.prisma as any).transaction.create({
                            data: {
                                userId: uid,
                                amount,
                                type: 'BONUS',
                                status: 'APPROVED',
                                paymentMethod: 'BONUS_WALLET',
                                paymentDetails: {
                                    source: 'ADMIN_BULK',
                                    bonusCode: 'ADMIN_BULK',
                                    bonusType: 'CASINO',
                                    applicableTo: 'CASINO',
                                    walletLabel: 'Casino Bonus',
                                    bonusCurrency: 'INR',
                                    depositAmount: 0,
                                    bonusAmount: amount,
                                    conversionCapAmount: amount,
                                    wageringRequired: 0,
                                },
                                remarks: 'Bulk Casino Bonus Action (Admin)',
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                        })
                    ]);
                    this.eventsGateway.emitUserWalletUpdate(uid);
                    results.push(uid);
                } catch (e) {
                    console.error(`Failed to give bonus to user ${uid}`, e);
                }
            }
            return { count: results.length, message: 'Bonuses processed' };
        }

        if (action === 'DELETE') {
            // Soft delete/Ban is safer
            return this.prisma.user.updateMany({
                where: { id: { in: userIds } },
                data: { isBanned: true }
            });
        }

        return { count: 0 };
    }

    /**
     * Called when a deposit is APPROVED / confirmed.
     * Adds the deposit amount to the user's total required turnover.
     */
    async setWageringOnFirstDeposit(userId: number, depositAmount: number) {
        if (depositAmount <= 0) return;
        await this.prisma.user.update({
            where: { id: userId },
            data: { totalDeposited: { increment: depositAmount } } as any
        });
    }

    /**
     * Called whenever a bet is placed (sports) or a casino round records a bet_amount.
     * Adds to wageringDone. Does not exceed wageringRequired (clamps at required value).
     */
    async incrementWageringDone(userId: number, amount: number) {
        if (amount <= 0) return;
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { totalDeposited: true, totalWagered: true } as any
        }) as any;
        if (!user || user.totalDeposited <= 0) return; // no deposit yet
        const newDone = Math.min(
            (user.totalWagered || 0) + amount,
            user.totalDeposited
        );
        await this.prisma.user.update({
            where: { id: userId },
            data: { totalWagered: newDone } as any
        });
    }
}
