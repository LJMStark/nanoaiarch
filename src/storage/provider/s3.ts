import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { S3mini } from 's3mini';
import { storageConfig } from '../config/storage-config';
import {
  ConfigurationError,
  type StorageConfig,
  StorageError,
  type StorageProvider,
  UploadError,
  type UploadFileParams,
  type UploadFileResult,
} from '../types';

// S3mini's public `additionalHeaders` parameter is typed to only accept
// `x-amz-*` keys, but the runtime accepts arbitrary headers and forwards them
// to the signed request. Cache-Control is a standard S3 object header, so we
// pass it through this widened type.
type S3MiniExtraHeaders = Record<string, string>;

/**
 * Amazon S3 storage provider implementation using S3mini
 *
 * docs:
 * https://mksaas.com/docs/storage
 *
 * Works with Amazon S3 and compatible services like Cloudflare R2.
 * https://github.com/good-lly/s3mini
 * https://developers.cloudflare.com/r2/
 */
export class S3Provider implements StorageProvider {
  private config: StorageConfig;
  private s3Client: S3mini | null = null;

  constructor(config: StorageConfig = storageConfig) {
    this.config = config;
  }

  /**
   * Get the provider name
   */
  public getProviderName(): string {
    return 'S3';
  }

  /**
   * Get the S3 client instance
   */
  private getS3Client(): S3mini {
    if (this.s3Client) {
      return this.s3Client;
    }

    const { region, endpoint, accessKeyId, secretAccessKey, bucketName } =
      this.config;

    if (!region) {
      throw new ConfigurationError('Storage region is not configured');
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new ConfigurationError('Storage credentials are not configured');
    }

    if (!endpoint) {
      throw new ConfigurationError('Storage endpoint is required for S3mini');
    }

    if (!bucketName) {
      throw new ConfigurationError('Storage bucket name is not configured');
    }

    // S3mini client configuration
    // The bucket name needs to be included in the endpoint URL for S3mini
    const endpointWithBucket = `${endpoint.replace(/\/$/, '')}/${bucketName}`;

    this.s3Client = new S3mini({
      accessKeyId,
      secretAccessKey,
      endpoint: endpointWithBucket,
      region,
    });

    return this.s3Client;
  }

  /**
   * Generate a unique filename with the original extension
   */
  private generateUniqueFilename(originalFilename: string): string {
    const extension = originalFilename.split('.').pop() || '';
    const uuid = randomUUID();
    return `${uuid}${extension ? `.${extension}` : ''}`;
  }

  /**
   * Upload a file to S3
   */
  public async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    try {
      const { file, filename, contentType, folder } = params;
      const s3 = this.getS3Client();
      const { bucketName } = this.config;

      const uniqueFilename = this.generateUniqueFilename(filename);
      const key = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

      // Convert Blob to Buffer if needed
      let fileContent: Buffer | string;
      if (file instanceof Blob) {
        fileContent = Buffer.from(await file.arrayBuffer());
      } else {
        fileContent = file;
      }

      const cacheControl = params.cacheControl ?? this.config.cacheControl;
      const extraHeaders: S3MiniExtraHeaders | undefined = cacheControl
        ? { 'Cache-Control': cacheControl }
        : undefined;

      const response = await s3.putObject(
        key,
        fileContent,
        contentType,
        undefined,
        extraHeaders as Parameters<S3mini['putObject']>[4]
      );

      if (!response.ok) {
        throw new UploadError(`Failed to upload file: ${response.statusText}`);
      }

      // Generate the URL
      const { publicUrl } = this.config;
      let url: string;

      if (publicUrl) {
        // Use custom domain if provided
        url = `${publicUrl.replace(/\/$/, '')}/${key}`;
        logger.storage.debug('uploadFile using public url', { url });
      } else {
        // For S3mini, we construct the URL manually
        // Since bucket is included in endpoint, we just append the key
        const baseUrl = this.config.endpoint?.replace(/\/$/, '') || '';
        url = `${baseUrl}/${key}`;
        logger.storage.debug('uploadFile using constructed url', { url });
      }

      return { url, key };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        logger.storage.error('uploadFile configuration error', error);
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during file upload';
      logger.storage.error('uploadFile error', new Error(message));
      throw new UploadError(message);
    }
  }

  /**
   * Delete a file from S3
   */
  public async deleteFile(key: string): Promise<void> {
    try {
      const s3 = this.getS3Client();

      const wasDeleted = await s3.deleteObject(key);

      if (!wasDeleted) {
        logger.storage.warn('File was not found or could not be deleted', {
          key,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during file deletion';
      logger.storage.error('deleteFile error', new Error(message));
      throw new StorageError(message);
    }
  }
}
