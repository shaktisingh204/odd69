import { IsNumber, IsString, IsOptional, Min, Max, IsIn } from 'class-validator';

export class StartMinesDto {
  @IsNumber()
  @Min(1)
  betAmount: number;

  @IsNumber()
  @Min(1)
  @Max(24)
  mineCount: number;

  @IsOptional()
  @IsString()
  clientSeed?: string;

  @IsOptional()
  @IsIn(['fiat', 'crypto'])
  walletType?: 'fiat' | 'crypto';

  @IsOptional()
  useBonus?: boolean;
}
