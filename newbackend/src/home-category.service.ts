import { Injectable } from '@nestjs/common';
import { CreateHomeCategoryDto } from './dto/create-home-category.dto';
import { UpdateHomeCategoryDto } from './dto/update-home-category.dto';

@Injectable()
export class HomeCategoryService {
  create(createHomeCategoryDto: CreateHomeCategoryDto) {
    return 'This action adds a new homeCategory';
  }

  findAll() {
    return `This action returns all homeCategory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} homeCategory`;
  }

  update(id: number, updateHomeCategoryDto: UpdateHomeCategoryDto) {
    return `This action updates a #${id} homeCategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} homeCategory`;
  }
}
