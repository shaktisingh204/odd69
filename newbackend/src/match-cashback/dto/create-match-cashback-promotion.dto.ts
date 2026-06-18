import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { CASHBACK_WALLET_TYPES, SPORTS_PROMOTION_TYPES } from '../match-cashback.constants';

export class TriggerConfigDto {
    @IsOptional()
    @IsString()
    eventType?: string;

    @IsOptional()
    @IsString()
    triggerMode?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    oversWindow?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    leadThreshold?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    minuteThreshold?: number;

    @IsOptional()
    @IsString()
    periodLabel?: string;

    @IsOptional()
    @IsArray()
    qualifyingSelections?: string[];

    @IsOptional()
    @IsString()
    scoreSnapshot?: string;

    @IsOptional()
    @IsString()
    triggerNote?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isTriggered?: boolean;
}

export class CreateMatchCashbackPromotionDto {
    @IsString()
    @IsNotEmpty()
    matchId: string;

    @IsOptional()
    @IsString()
    @IsIn(SPORTS_PROMOTION_TYPES)
    promotionType?: string;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100)
    refundPercentage: number;

    @IsString()
    @IsIn(CASHBACK_WALLET_TYPES)
    walletType: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxRefundAmount?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    teamA?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    teamB?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    matchDate?: string;

    @IsOptional()
    @IsString()
    eventName?: string;

    @IsOptional()
    @IsString()
    sportId?: string;

    @IsOptional()
    @IsArray()
    teams?: string[];

    @IsOptional()
    @IsString()
    cardTitle?: string;

    @IsOptional()
    @IsString()
    cardDescription?: string;

    @IsOptional()
    @IsString()
    cardGradient?: string;

    @IsOptional()
    @IsString()
    cardBgImage?: string;

    @IsOptional()
    @IsString()
    cardBadge?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    order?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    showOnPromotionsPage?: boolean;

    @IsOptional()
    @ValidateNested()
    @Type(() => TriggerConfigDto)
    triggerConfig?: TriggerConfigDto;
}
