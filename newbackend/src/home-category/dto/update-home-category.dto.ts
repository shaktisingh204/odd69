import { PartialType } from '@nestjs/mapped-types';
import { CreateHomeCategoryDto } from './create-home-category.dto';

export class UpdateHomeCategoryDto extends PartialType(CreateHomeCategoryDto) { }
