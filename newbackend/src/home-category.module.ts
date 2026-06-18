import { Module } from '@nestjs/common';
import { HomeCategoryService } from './home-category.service';
import { HomeCategoryController } from './home-category.controller';

@Module({
  controllers: [HomeCategoryController],
  providers: [HomeCategoryService],
})
export class HomeCategoryModule {}
