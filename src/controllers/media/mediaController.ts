import type { Request, Response } from 'express';

import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { grnDocuments, productImages, repairDocuments } from '../../db/schema';
import { AppError } from '../../errors/app-error';
import {
  deleteFileFromFolder,
  deleteImageFromFolder,
  uploadFileToFolder,
  uploadImageToFolder,
  uploadProductImage,
  uploadRepairImage,
} from '../../services/media/cloudinaryService';
import {
  isCloudinaryFileFolder,
  isCloudinaryImageFolder,
  type CloudinaryFileFolder,
  type CloudinaryImageFolder,
} from '../../services/media/mediaFolders';

const imageFolderFromRequest = (req: Request): CloudinaryImageFolder => {
  const folderKey = typeof req.params.folderKey === 'string' ? req.params.folderKey : '';
  if (!folderKey || !isCloudinaryImageFolder(folderKey)) {
    throw new AppError('The selected image folder is not supported.', 404);
  }
  return folderKey;
};

const fileFolderFromRequest = (req: Request): CloudinaryFileFolder => {
  const folderKey = typeof req.params.folderKey === 'string' ? req.params.folderKey : '';
  if (!folderKey || !isCloudinaryFileFolder(folderKey)) {
    throw new AppError('The selected file folder is not supported.', 404);
  }
  return folderKey;
};

const assertRepairImageIsDraft = async (publicId: string) => {
  const [attachedDocument] = await db.select({ id: repairDocuments.id })
    .from(repairDocuments)
    .where(eq(repairDocuments.cloudinaryPublicId, publicId))
    .limit(1);
  if (attachedDocument) {
    throw new AppError('This image is already attached to a repair job and cannot be removed from a draft.', 409);
  }
};

const assertProductImageIsDraft = async (publicId: string) => {
  const [attachedImage] = await db.select({ id: productImages.id })
    .from(productImages)
    .where(eq(productImages.cloudinaryPublicId, publicId))
    .limit(1);
  if (attachedImage) {
    throw new AppError('This image is already attached to a product and cannot be removed from a draft.', 409);
  }
};

const assertGrnInvoiceIsDraft = async (publicId: string) => {
  const [attachedDocument] = await db.select({ id: grnDocuments.id })
    .from(grnDocuments)
    .where(eq(grnDocuments.cloudinaryPublicId, publicId))
    .limit(1);
  if (attachedDocument) {
    throw new AppError('This invoice file is already attached to a GRN and cannot be removed from a draft.', 409);
  }
};

const deleteDraftImage = async (publicId: string, folder: CloudinaryImageFolder) => {
  if (folder === 'productImages') await assertProductImageIsDraft(publicId);
  if (folder === 'repairImages') await assertRepairImageIsDraft(publicId);
  await deleteImageFromFolder(publicId, folder);
};

const deleteDraftFile = async (publicId: string, folder: CloudinaryFileFolder) => {
  if (folder === 'grnInvoices') await assertGrnInvoiceIsDraft(publicId);
  await deleteFileFromFolder(publicId, folder);
};

export const uploadProductImageFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new AppError('Select one image file to upload.', 400);
  const data = await uploadProductImage(req.file);
  res.status(201).json({ success: true, data });
};

export const deleteProductImageFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';
  if (!publicId) throw new AppError('An image public ID is required.', 400);
  await deleteDraftImage(publicId, 'productImages');
  res.status(200).json({ success: true, data: { publicId } });
};

export const uploadRepairImageFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new AppError('Select one image file to upload.', 400);
  const data = await uploadRepairImage(req.file);
  res.status(201).json({ success: true, data });
};

export const deleteRepairImageFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';
  if (!publicId) throw new AppError('An image public ID is required.', 400);
  await deleteDraftImage(publicId, 'repairImages');
  res.status(200).json({ success: true, data: { publicId } });
};

export const uploadImageFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new AppError('Select one image file to upload.', 400);
  const data = await uploadImageToFolder(req.file, imageFolderFromRequest(req));
  res.status(201).json({ success: true, data });
};

export const deleteImageFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';
  if (!publicId) throw new AppError('An image public ID is required.', 400);
  await deleteDraftImage(publicId, imageFolderFromRequest(req));
  res.status(200).json({ success: true, data: { publicId } });
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new AppError('Select one invoice file to upload.', 400);
  const data = await uploadFileToFolder(req.file, fileFolderFromRequest(req));
  res.status(201).json({ success: true, data });
};

export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  const publicId = typeof req.body?.publicId === 'string' ? req.body.publicId.trim() : '';
  if (!publicId) throw new AppError('An invoice file public ID is required.', 400);
  await deleteDraftFile(publicId, fileFolderFromRequest(req));
  res.status(200).json({ success: true, data: { publicId } });
};
