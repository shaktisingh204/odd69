import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchCashbackPromotionDto } from './create-match-cashback-promotion.dto';

export class UpdateMatchCashbackPromotionDto extends PartialType(CreateMatchCashbackPromotionDto) { }
