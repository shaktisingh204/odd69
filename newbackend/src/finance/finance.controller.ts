import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN, Role.MANAGER)
export class FinanceController {
    constructor(private readonly financeService: FinanceService) { }

    // Payment Gateway Config
    @Get('methods')
    async getPaymentMethods() {
        return this.financeService.getPaymentMethods();
    }

    @Post('methods')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async createPaymentMethod(@Body() body: any) {
        return this.financeService.createPaymentMethod(body);
    }

    @Patch('methods/:id')
    @Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
    async updatePaymentMethod(@Param('id') id: string, @Body() body: any) {
        return this.financeService.updatePaymentMethod(parseInt(id), body);
    }

    @Delete('methods/:id')
    @Roles(Role.TECH_MASTER)
    async deletePaymentMethod(@Param('id') id: string) {
        return this.financeService.deletePaymentMethod(parseInt(id));
    }

    // Reconciliation
    @Post('reconcile')
    @UseInterceptors(FileInterceptor('file'))
    async reconcile(@UploadedFile() file: Express.Multer.File) {
        // file.buffer contains the CSV
        // return this.financeService.reconcileTransactions(file.buffer);
        return { message: "Reconciliation feature coming soon" };
    }
}
