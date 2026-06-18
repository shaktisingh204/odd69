import {
    IsBoolean,
    IsEmail,
    IsEnum,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

/**
 * Allow-listed fields an admin may mutate via PATCH /user/:id.
 *
 * SECURITY: The ValidationPipe is configured with `whitelist: true`, so any
 * field NOT defined here (e.g. `role`, `password`, `managerId`, `balance`,
 * `cryptoBalance`) is silently stripped. Role changes must go through the
 * dedicated /user/assign-manager or admin panel role-management flow so they
 * can be audit-logged and re-authenticated.
 */
export class AdminUpdateUserDto {
    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    country?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsBoolean()
    isBanned?: boolean;

    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @IsOptional()
    @IsEnum(['fiat', 'crypto'])
    activeWallet?: 'fiat' | 'crypto';

    @IsOptional()
    @IsNumber()
    @Min(0)
    depositLimit?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    lossLimit?: number;
}
