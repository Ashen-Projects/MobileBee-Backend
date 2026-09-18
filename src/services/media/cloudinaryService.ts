import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import { cloudinaryEnv } from '../../env';
import { AppError } from '../../errors/app-error';
import {
  CLOUDINARY_MEDIA_FOLDERS,
  type CloudinaryFileFolder,
  type CloudinaryImageFolder,
  type CloudinaryMediaFolder,
} from './mediaFolders';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INVOICE_BYTES = 10 * 1024 * 1024;
const acceptedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const acceptedInvoiceMimeTypes = new Set(['application/pdf', ...acceptedImageMimeTypes]);

const assertConfigured = () => {
  if (!cloudinaryEnv) {
    throw new AppError('Media uploads are not configured. Add the Cloudinary environment variables and restart the API.', 503);
  }
  cloudinary.config({
    api_key: cloudinaryEnv.apiKey,
    api_secret: cloudinaryEnv.apiSecret,
    cloud_name: cloudinaryEnv.cloudName,
    secure: true,
  });
  return cloudinaryEnv;
};

const assertUploadFile = (file: Express.Multer.File) => {
  if (!acceptedImageMimeTypes.has(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, and WebP images are allowed.', 400);
  }
  if (!file.buffer.length) throw new AppError('The selected image is empty.', 400);
  if (file.size > MAX_IMAGE_BYTES) throw new AppError('Each image must be 5 MB or smaller.', 400);
  const isJpeg = file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const isPng = file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new AppError('The selected file is not a valid image.', 400);
};

const hasImageSignature = (file: Express.Multer.File) => {
  const isJpeg = file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const isPng = file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
};

const assertInvoiceUploadFile = (file: Express.Multer.File) => {
  if (!acceptedInvoiceMimeTypes.has(file.mimetype)) {
    throw new AppError('Only PDF, JPEG, PNG, and WebP invoice files are allowed.', 400);
  }
  if (!file.buffer.length) throw new AppError('The selected invoice file is empty.', 400);
  if (file.size > MAX_INVOICE_BYTES) throw new AppError('Each invoice file must be 10 MB or smaller.', 400);
  const isPdf = file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (!isPdf && !hasImageSignature(file)) {
    throw new AppError('The selected invoice file is not a valid PDF or image.', 400);
  }
};

const folderFor = (mediaFolder: CloudinaryMediaFolder) => CLOUDINARY_MEDIA_FOLDERS[mediaFolder];

const isManagedAsset = (publicId: string, mediaFolder: CloudinaryMediaFolder) => {
  const folder = folderFor(mediaFolder);
  return publicId.startsWith(`${folder}/`)
    && /^[A-Za-z0-9_./-]+$/.test(publicId)
    && !publicId.includes('..');
};

const uploadBuffer = (buffer: Buffer, folder: string) => new Promise<UploadApiResponse>((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({
    folder,
    overwrite: false,
    resource_type: 'image',
    transformation: [{ crop: 'limit', height: 2000, width: 2000 }],
    unique_filename: true,
    use_filename: false,
  }, (error, result) => {
    if (error) reject(error);
    else if (result) resolve(result);
    else reject(new Error('Cloudinary did not return an uploaded image.'));
  });
  stream.end(buffer);
});

export const uploadImageToFolder = async (file: Express.Multer.File, mediaFolder: CloudinaryImageFolder) => {
  assertConfigured();
  assertUploadFile(file);
  try {
    const uploaded = await uploadBuffer(file.buffer, folderFor(mediaFolder));
    return {
      bytes: uploaded.bytes,
      format: uploaded.format,
      height: uploaded.height,
      publicId: uploaded.public_id,
      url: cloudinary.url(uploaded.public_id, {
        fetch_format: 'auto',
        quality: 'auto',
        secure: true,
        transformation: [{ crop: 'limit', height: 1600, width: 1600 }],
      }),
      width: uploaded.width,
    };
  } catch (error) {
    throw new AppError('Unable to upload the image. Please try again.', 502, false);
  }
};

const uploadInvoiceBuffer = (buffer: Buffer, folder: string) => new Promise<UploadApiResponse>((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({
    folder,
    overwrite: false,
    resource_type: 'raw',
    unique_filename: true,
    use_filename: false,
  }, (error, result) => {
    if (error) reject(error);
    else if (result) resolve(result);
    else reject(new Error('Cloudinary did not return an uploaded invoice file.'));
  });
  stream.end(buffer);
});

export const uploadFileToFolder = async (file: Express.Multer.File, mediaFolder: CloudinaryFileFolder) => {
  assertConfigured();
  assertInvoiceUploadFile(file);
  try {
    const uploaded = await uploadInvoiceBuffer(file.buffer, folderFor(mediaFolder));
    return {
      bytes: uploaded.bytes,
      format: uploaded.format,
      publicId: uploaded.public_id,
      url: uploaded.secure_url,
    };
  } catch {
    throw new AppError('Unable to upload the invoice file. Please try again.', 502, false);
  }
};

export const uploadProductImage = async (file: Express.Multer.File) => {
  return uploadImageToFolder(file, 'productImages');
};

export const uploadRepairImage = async (file: Express.Multer.File) => {
  return uploadImageToFolder(file, 'repairImages');
};

export const uploadGrnInvoiceFile = async (file: Express.Multer.File) => uploadFileToFolder(file, 'grnInvoices');

export const deleteImageFromFolder = async (publicId: string, mediaFolder: CloudinaryImageFolder) => {
  assertConfigured();
  if (!isManagedAsset(publicId, mediaFolder)) {
    throw new AppError('The image asset cannot be removed.', 400);
  }
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
  } catch {
    throw new AppError('Unable to remove the image asset. Please try again.', 502, false);
  }
};

export const deleteFileFromFolder = async (publicId: string, mediaFolder: CloudinaryFileFolder) => {
  assertConfigured();
  if (!isManagedAsset(publicId, mediaFolder)) {
    throw new AppError('The invoice file cannot be removed.', 400);
  }
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'raw' });
  } catch {
    throw new AppError('Unable to remove the invoice file. Please try again.', 502, false);
  }
};

export const deleteProductImage = async (publicId: string) => deleteImageFromFolder(publicId, 'productImages');

export const deleteRepairImage = async (publicId: string) => deleteImageFromFolder(publicId, 'repairImages');

export const deleteGrnInvoiceFile = async (publicId: string) => deleteFileFromFolder(publicId, 'grnInvoices');

export const repairImageUrl = (publicId: string) => {
  assertConfigured();
  if (!isManagedAsset(publicId, 'repairImages')) {
    throw new AppError('The repair image reference is invalid.', 400);
  }
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
    transformation: [{ crop: 'limit', height: 1600, width: 1600 }],
  });
};

export const grnInvoiceFileUrl = (publicId: string) => {
  assertConfigured();
  if (!isManagedAsset(publicId, 'grnInvoices')) {
    throw new AppError('The supplier invoice reference is invalid.', 400);
  }
  return cloudinary.url(publicId, { resource_type: 'raw', secure: true });
};
