import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const toTrimmedString = ({ value }: { value: unknown }) =>
  String(value ?? '').trim();

const toNormalizedBetType = ({ value }: { value: unknown }) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export class PlaceBetDto {
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(64)
  eventId: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(256)
  eventName?: string;

  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(512) // SR market IDs can be very long composite strings
  // e.g. '1230:sp:overnr=15|total=152.5|inningnr=1|maxovers=20|team=home|...'
  marketId: string;

  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(512) // Runner IDs are short ('12','13') but keep consistent with marketId
  selectionId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  odds: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1.01)
  rate?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  stake: number;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsIn(['fiat', 'crypto', 'fiat-main', 'fiat-casino', 'fiat-sports', 'crypto-main', 'crypto-casino', 'crypto-sports'])
  walletType?: string;

  @IsOptional()
  @Transform(toNormalizedBetType)
  @IsIn(['back', 'lay'])
  betType?: 'back' | 'lay';

  @IsOptional()
  @Transform(toNormalizedBetType)
  @IsIn(['back', 'lay'])
  type?: 'back' | 'lay';

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(256)
  selectionName?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(256)
  marketName?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(80)
  clientRequestId?: string;

  // ── Sportradar-only fields ─────────────────────────────────────────────────
  // Passed from the frontend bet-slip when placing on an sr:match:* event.
  // Avoids an extra Redis/DB lookup to resolve the sport.

  /** e.g. 'sr:sport:21'  (cricket) */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(64)
  srSportId?: string;

  /**
   * The full composite marketId from the market-result API response.
   * e.g. '1230:sp:overnr=15|total=152.5|inningnr=1|maxovers=20'
   * Same as marketId for SR bets — duplicated here for clarity.
   */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(512)
  srMarketFullId?: string;

  /** runnerId e.g. '12', '13', '4', '5', '70', '72', '74', '76' */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(32)
  srRunnerId?: string;

  /** Human-readable runner name e.g. 'over 152.5', 'Brisbane Napoleons' */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(128)
  srRunnerName?: string;

  /** Full market name e.g. '1st innings overs 0 to 15 - Iconic Super Knights total' */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(256)
  srMarketName?: string;
}
