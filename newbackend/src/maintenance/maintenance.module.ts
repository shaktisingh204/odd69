import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { MaintenanceService } from './maintenance.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
