import { IsString } from 'class-validator';

export class CashoutDto {
  @IsString()
  gameId: string;   // MongoDB ObjectId string
}
