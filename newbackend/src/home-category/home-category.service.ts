import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHomeCategoryDto } from './dto/create-home-category.dto';
import { UpdateHomeCategoryDto } from './dto/update-home-category.dto';
import { HomeCategory, HomeCategoryDocument } from './schemas/home-category.schema';

@Injectable()
export class HomeCategoryService {
    constructor(
        @InjectModel(HomeCategory.name) private homeCategoryModel: Model<HomeCategoryDocument>,
    ) { }

    async create(createHomeCategoryDto: CreateHomeCategoryDto): Promise<HomeCategory> {
        const createdCategory = new this.homeCategoryModel(createHomeCategoryDto);
        return createdCategory.save();
    }

    async findAll(): Promise<HomeCategory[]> {
        return this.homeCategoryModel.find().sort({ order: 1 }).exec();
    }

    async findOne(id: string): Promise<HomeCategory> {
        const category = await this.homeCategoryModel.findById(id).exec();
        if (!category) {
            throw new NotFoundException(`HomeCategory with ID ${id} not found`);
        }
        return category;
    }

    async update(id: string, updateHomeCategoryDto: UpdateHomeCategoryDto): Promise<HomeCategory> {
        const updatedCategory = await this.homeCategoryModel
            .findByIdAndUpdate(id, updateHomeCategoryDto, { returnDocument: 'after' })
            .exec();

        if (!updatedCategory) {
            throw new NotFoundException(`HomeCategory with ID ${id} not found`);
        }
        return updatedCategory;
    }

    async remove(id: string): Promise<HomeCategory> {
        const deletedCategory = await this.homeCategoryModel.findByIdAndDelete(id).exec();
        if (!deletedCategory) {
            throw new NotFoundException(`HomeCategory with ID ${id} not found`);
        }
        return deletedCategory;
    }
}
