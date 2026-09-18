import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import * as controller from '../../controllers/media/mediaController';
import { AppError } from '../../errors/app-error';
import { requireAnyPermission } from '../../middlewares/permissionMiddleware';
import { isCloudinaryFileFolder, isCloudinaryImageFolder, type CloudinaryFileFolder, type CloudinaryImageFolder } from '../../services/media/mediaFolders';
import { asyncHandler } from '../../utils/async-handler';
import { USER_PERMISSIONS } from '../../utils/constants';

export const mediaRoutes = Router();

const upload = multer({
  fileFilter: (_req, file, callback) => {
    const accepted = file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp';
    if (!accepted) return callback(new AppError('Only JPEG, PNG, and WebP images are allowed.', 400));
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  storage: multer.memoryStorage(),
});

const uploadSingleImage: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('Each image must be 5 MB or smaller.', 400));
      return;
    }
    if (error) next(error);
    else next();
  });
};

const invoiceUpload = multer({
  fileFilter: (_req, file, callback) => {
    const accepted = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!accepted) return callback(new AppError('Only PDF, JPEG, PNG, and WebP invoice files are allowed.', 400));
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  storage: multer.memoryStorage(),
});

const uploadSingleInvoice: RequestHandler = (req, res, next) => {
  invoiceUpload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('Each invoice file must be 10 MB or smaller.', 400));
      return;
    }
    if (error) next(error);
    else next();
  });
};

const imageFolderPermissions: Record<CloudinaryImageFolder, [string, string]> = {
  productImages: [USER_PERMISSIONS.PRODUCTS_CREATE, USER_PERMISSIONS.PRODUCTS_UPDATE],
  repairImages: [USER_PERMISSIONS.REPAIRS_CREATE, USER_PERMISSIONS.REPAIRS_UPDATE],
};

const fileFolderPermissions: Record<CloudinaryFileFolder, [string, string]> = {
  grnInvoices: [USER_PERMISSIONS.GRNS_CREATE, USER_PERMISSIONS.GRNS_DOCUMENTS],
};

const requireImageFolderPermission: RequestHandler = (req, res, next) => {
  const folderKey = typeof req.params.folderKey === 'string' ? req.params.folderKey : '';
  if (!folderKey || !isCloudinaryImageFolder(folderKey)) {
    next(new AppError('The selected image folder is not supported.', 404));
    return;
  }
  requireAnyPermission(...imageFolderPermissions[folderKey])(req, res, next);
};

const requireFileFolderPermission: RequestHandler = (req, res, next) => {
  const folderKey = typeof req.params.folderKey === 'string' ? req.params.folderKey : '';
  if (!folderKey || !isCloudinaryFileFolder(folderKey)) {
    next(new AppError('The selected file folder is not supported.', 404));
    return;
  }
  requireAnyPermission(...fileFolderPermissions[folderKey])(req, res, next);
};

mediaRoutes.post('/product-images', requireAnyPermission(USER_PERMISSIONS.PRODUCTS_CREATE, USER_PERMISSIONS.PRODUCTS_UPDATE), uploadSingleImage, asyncHandler(controller.uploadProductImageFile));
mediaRoutes.delete('/product-images', requireAnyPermission(USER_PERMISSIONS.PRODUCTS_CREATE, USER_PERMISSIONS.PRODUCTS_UPDATE), asyncHandler(controller.deleteProductImageFile));
mediaRoutes.post('/repair-images', requireAnyPermission(USER_PERMISSIONS.REPAIRS_CREATE, USER_PERMISSIONS.REPAIRS_UPDATE), uploadSingleImage, asyncHandler(controller.uploadRepairImageFile));
mediaRoutes.delete('/repair-images', requireAnyPermission(USER_PERMISSIONS.REPAIRS_CREATE, USER_PERMISSIONS.REPAIRS_UPDATE), asyncHandler(controller.deleteRepairImageFile));
mediaRoutes.post('/images/:folderKey', requireImageFolderPermission, uploadSingleImage, asyncHandler(controller.uploadImageFile));
mediaRoutes.delete('/images/:folderKey', requireImageFolderPermission, asyncHandler(controller.deleteImageFile));
mediaRoutes.post('/files/:folderKey', requireFileFolderPermission, uploadSingleInvoice, asyncHandler(controller.uploadFile));
mediaRoutes.delete('/files/:folderKey', requireFileFolderPermission, asyncHandler(controller.deleteFile));
