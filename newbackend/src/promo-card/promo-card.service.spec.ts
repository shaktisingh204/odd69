import { Test, TestingModule } from '@nestjs/testing';
import { PromoCardService } from './promo-card.service';

describe('PromoCardService', () => {
  let service: PromoCardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromoCardService],
    }).compile();

    service = module.get<PromoCardService>(PromoCardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
