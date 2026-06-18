import { Global, Module, forwardRef } from '@nestjs/common';
import { EventsGateway, ExternalEventsGateway } from './events.gateway';
import { SportsModule } from './sports/sports.module';

@Global()
@Module({
    imports: [forwardRef(() => SportsModule)],
    providers: [EventsGateway, ExternalEventsGateway],
    exports: [EventsGateway, ExternalEventsGateway],
})
export class EventsModule { }
