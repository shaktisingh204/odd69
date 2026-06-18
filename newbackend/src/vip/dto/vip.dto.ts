import { IsString, IsOptional, IsNumber, Min, MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateVipApplicationDto {
    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Message must be under 1000 characters' })
    message?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100, { message: 'Platform name must be under 100 characters' })
    currentPlatform?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50, { message: 'Platform username must be under 50 characters' })
    platformUsername?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Monthly volume must be a number' })
    @Min(0, { message: 'Monthly volume cannot be negative' })
    monthlyVolume?: number;
}

export class ReviewVipApplicationDto {
    @IsNotEmpty()
    status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reviewNotes?: string;

    @IsOptional()
    @IsString()
    assignedTier?: 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
}

export class UpdateVipTierDto {
    @IsNotEmpty()
    @IsString()
    tier: 'NONE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
}
