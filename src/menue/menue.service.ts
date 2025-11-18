import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menue } from './entities/menue.entity';
import { Category } from '../category/entities/category.entity';
import { CreateMenueDto } from './dto/create-menue.dto';
import { UpdateMenueDto } from './dto/update-menue.dto';

@Injectable()
export class MenueService {
  constructor(
    @InjectRepository(Menue)
    private productRepository: Repository<Menue>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createMenueDto: CreateMenueDto, userId: string): Promise<Menue> {
    const { categoryId, name, description, price, stock } = createMenueDto;

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new BadRequestException(`Category with ID ${categoryId} not found`);
    }

    const existingProduct = await this.productRepository.findOne({
      where: { name },
    });

    if (existingProduct) {
      throw new BadRequestException('Menu with this name already exists');
    }

    const product = this.productRepository.create({
      name,
      description,
      price,
      stock,
      categoryId,
      userId,
    });

    return await this.productRepository.save(product);
  }
  async findAll(): Promise<Menue[]> {
    const menues = await this.productRepository.find({
      relations: ['category', 'user'],
      order: { createdAt: 'DESC' },
    });

    return menues.map((menue) => {
      if (menue.user) {
        const { password, ...safeUser } = menue.user;
        menue.user = safeUser as any;
      }
      return menue;
    });
  }

  async findByCategory(categoryId: number): Promise<Menue[]> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    return await this.productRepository.find({
      where: { categoryId },
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Menue> {
    const menue = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'user'],
    });

    if (!menue) {
      throw new NotFoundException(`Menue with ID ${id} not found`);
    }

    if (menue.user) {
      const { password, ...safeUser } = menue.user;
      menue.user = safeUser as any;
    }

    return menue;
  }

  async update(
    id: number,
    updateMenueDto: UpdateMenueDto,
    userId: string,
  ): Promise<Menue> {
    const menue = await this.findOne(id);

    if (menue.userId !== userId) {
      throw new ForbiddenException('You can only update your own menues');
    }

    if (updateMenueDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: updateMenueDto.categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${updateMenueDto.categoryId} not found`,
        );
      }
    }

    if (updateMenueDto.name && updateMenueDto.name !== menue.name) {
      const existingMenue = await this.productRepository.findOne({
        where: { name: updateMenueDto.name },
      });

      if (existingMenue) {
        throw new BadRequestException('Menue with this name already exists');
      }
    }

    Object.assign(menue, updateMenueDto);
    return await this.productRepository.save(menue);
  }

  async remove(id: number, userId: string): Promise<{ message: string }> {
    const menue = await this.findOne(id);

    if (menue.userId !== userId) {
      throw new ForbiddenException('You can only delete your own menues');
    }

    await this.productRepository.remove(menue);
    return { message: 'Menue deleted successfully' };
  }

  async findByUser(userId: string): Promise<Menue[]> {
    return await this.productRepository.find({
      where: { userId },
      relations: ['category'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStock(
    id: number,
    newStock: number,
    userId: string,
  ): Promise<Menue> {
    const menue = await this.findOne(id);

    if (menue.userId !== userId) {
      throw new ForbiddenException('You can only update your own menues');
    }

    if (newStock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    menue.stock = newStock;
    return await this.productRepository.save(menue);
  }

  async search(query: string): Promise<Menue[]> {
    return await this.productRepository
      .createQueryBuilder('menue')
      .leftJoinAndSelect('menue.category', 'category')
      .leftJoinAndSelect('menue.user', 'user')
      .where('menue.name ILIKE :query', { query: `%${query}%` })
      .orWhere('menue.description ILIKE :query', { query: `%${query}%` })
      .orWhere('category.name ILIKE :query', { query: `%${query}%` })
      .select([
        'menue',
        'category.id',
        'category.name',
        'user.id',
        'user.name',
        'user.email',
      ])
      .orderBy('menue.name', 'ASC')
      .getMany();
  }
}
