import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RunnerStatusDto {
    @IsNumber()
    runner_id: number;

    @IsString()
    status: string; // e.g., "WINNER", "LOSER"
}

export class WebhookPayloadDto {
    @IsNumber()
    source_sport_id: number;

    @IsNumber()
    sys_market_id: number;

    @IsString()
    source_market_id: string;

    @IsNumber()
    @IsOptional()
    source_market_status_id?: number;

    @IsNumber()
    @IsOptional()
    status?: number;


    @IsNumber()
    @IsOptional()
    is_active?: number; // 0 or 1

    @IsNumber()
    @IsOptional()
    source_is_in_play?: number;

    @IsBoolean()
    @IsOptional()
    source_is_bet_allow?: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RunnerStatusDto)
    runners: RunnerStatusDto[];
}
