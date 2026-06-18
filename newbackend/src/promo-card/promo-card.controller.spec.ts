import { Test, TestingModule } from '@nestjs/testing';
import { PromoCardController } from './promo-card.controller';

describe('PromoCardController', () => {
  let controller: PromoCardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoCardController],
    }).compile();

    controller = module.get<PromoCardController>(PromoCardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
