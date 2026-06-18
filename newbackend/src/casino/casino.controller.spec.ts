import { Test, TestingModule } from '@nestjs/testing';
import { CasinoController } from './casino.controller';

describe('CasinoController', () => {
  let controller: CasinoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasinoController],
    }).compile();

    controller = module.get<CasinoController>(CasinoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
