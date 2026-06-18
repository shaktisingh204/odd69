import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FinanceService {
    constructor(private prisma: PrismaService) { }

    // Payment Methods
    async getPaymentMethods() {
        return this.prisma.paymentMethod.findMany({
            orderBy: { id: 'asc' } // Changed from order to id
        });
    }

    async createPaymentMethod(data: any) {
        return this.prisma.paymentMethod.create({ data });
    }

    async updatePaymentMethod(id: number, data: any) {
        return this.prisma.paymentMethod.update({
            where: { id },
            data
        });
    }

    async deletePaymentMethod(id: number) {
        return this.prisma.paymentMethod.delete({
            where: { id }
        });
    }

    // Reconciliation
    async reconcileTransactions(fileBuffer: Buffer) {
        // Placeholder for CSV implementation
        // 1. Parse CSV
        // 2. Iterate and match with prisma.transaction.findUnique({ where: { utr: ... } })
        // 3. Return report
        return { message: "Reconciliation logic to be implemented" };
    }
}
