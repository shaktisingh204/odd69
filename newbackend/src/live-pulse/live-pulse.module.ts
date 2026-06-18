import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LivePulseController } from './live-pulse.controller';
import { LivePulseService } from './live-pulse.service';
import { LivePulse, LivePulseSchema } from './schemas/live-pulse.schema';
import { EventsModule } from '../events.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LivePulse.name, schema: LivePulseSchema }]),
    forwardRef(() => EventsModule),
  ],
  controllers: [LivePulseController],
  providers: [LivePulseService],
  exports: [LivePulseService],
})
export class LivePulseModule {}
