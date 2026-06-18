import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SettleMatchDto {
    @IsString()
    @IsNotEmpty()
    matchId: string;

    @IsString()
    @IsNotEmpty()
    winningTeam: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    note?: string;
}
