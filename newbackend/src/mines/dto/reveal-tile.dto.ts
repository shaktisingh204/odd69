import { IsString, IsNumber, Min, Max } from 'class-validator';

export class RevealTileDto {
  @IsString()
  gameId: string;   // MongoDB ObjectId string

  @IsNumber()
  @Min(0)
  @Max(24)
  tileIndex: number;
}
