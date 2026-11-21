import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  constructor(private readonly supabase: SupabaseService) {}

  async uploadFile(bucket: string, filePath: string, fileBuffer: Buffer, mimeType: string, organizationId: string) {
    try {
      const { data, error } = await this.supabase.getClient().storage.from(bucket).upload(filePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
      });

      if (error) {
        this.logger.error('Error uploading file:', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error in uploadFile:', error);
      throw error;
    }
  }

  async getFileUrl(bucket: string, filePath: string, organizationId: string) {
    try {
      const { data } = await this.supabase.getClient().storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      this.logger.error('Error getting file URL:', error);
      throw error;
    }
  }

  async removeFile(bucket: string, filePath: string, organizationId: string) {
    try {
      const { error } = await this.supabase.getClient().storage.from(bucket).remove([filePath]);
      if (error) {
        this.logger.error('Error removing file:', error);
        throw error;
      }
      return { success: true };
    } catch (error) {
      this.logger.error('Error in removeFile:', error);
      throw error;
    }
  }
}