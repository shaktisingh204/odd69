import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';

describe('BetsController', () => {
  let controller: BetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BetsController],
      providers: [
        {
          provide: BetsService,
          useValue: {
            placeBet: jest.fn(),
            getUserBets: jest.fn(),
            getAllBets: jest.fn(),
            cancelBet: jest.fn(),
            settleMarket: jest.fn(),
            getCashoutOffer: jest.fn(),
            executeCashout: jest.fn(),
          },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    }).compile();

    controller = module.get<BetsController>(BetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
