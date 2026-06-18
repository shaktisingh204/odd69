import { Test, TestingModule } from '@nestjs/testing';
import { CasinoService } from './casino.service';

describe('CasinoService', () => {
  let service: CasinoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CasinoService],
    }).compile();

    service = module.get<CasinoService>(CasinoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
