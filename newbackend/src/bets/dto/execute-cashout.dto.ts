import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ExecuteCashoutDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  @Max(1)
  fraction?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  clientExpectedValue?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  fullRefund?: boolean;
}
