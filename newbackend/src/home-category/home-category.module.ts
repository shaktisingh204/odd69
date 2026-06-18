import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeCategoryController } from './home-category.controller';
import { HomeCategoryService } from './home-category.service';
import { HomeCategory, HomeCategorySchema } from './schemas/home-category.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: HomeCategory.name, schema: HomeCategorySchema }]),
    ],
    controllers: [HomeCategoryController],
    providers: [HomeCategoryService],
})
export class HomeCategoryModule { }
