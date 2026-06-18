import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetPromotionTriggerDto {
    @Type(() => Boolean)
    @IsBoolean()
    isTriggered: boolean;

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
}
