import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationGuard } from '../guards/authentication.guard';

class UploadImageDto {
  @IsString()
  data: string;
}

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

@SkipThrottle()
@Controller('upload')
export class UploadController {
  @UseGuards(AuthenticationGuard)
  @Post('image')
  uploadImage(@Body() dto: UploadImageDto) {
    console.log('[UPLOAD] body keys:', dto ? Object.keys(dto) : 'NO BODY');
    console.log('[UPLOAD] data type:', typeof dto?.data, '| starts with:', dto?.data?.slice(0, 30));
    const { data } = dto;
    if (!data) throw new BadRequestException('No image data provided');

    const match = data.match(/^data:(image\/[\w+.-]+);base64,(.+)$/s);
    if (!match) throw new BadRequestException('Invalid base64 image format');

    const mime = match[1];
    const ext = MIME_EXT[mime] ?? '.jpg';
    const payload = match[2];

    const filename = `${uuidv4()}${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), Buffer.from(payload, 'base64'));

    return { url: `/uploads/${filename}` };
  }
}
