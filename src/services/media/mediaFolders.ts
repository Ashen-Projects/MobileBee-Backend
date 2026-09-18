/**
 * The only source of truth for Cloudinary media paths.
 *
 * Add a named entry here when a new module needs image storage. Keeping paths
 * in code avoids deployment-specific folders and lets each API enforce its
 * own allowable folder during upload, URL creation, and deletion.
 */
export const CLOUDINARY_MEDIA_FOLDERS = {
  productImages: 'mobee/products',
  repairImages: 'mobee/repairs',
  grnInvoices: 'mobee/grn-invoices',
} as const;

export type CloudinaryMediaFolder = keyof typeof CLOUDINARY_MEDIA_FOLDERS;

export type CloudinaryImageFolder = 'productImages' | 'repairImages';
export type CloudinaryFileFolder = 'grnInvoices';

export const isCloudinaryMediaFolder = (value: string): value is CloudinaryMediaFolder =>
  Object.prototype.hasOwnProperty.call(CLOUDINARY_MEDIA_FOLDERS, value);

export const isCloudinaryImageFolder = (value: string): value is CloudinaryImageFolder =>
  value === 'productImages' || value === 'repairImages';

export const isCloudinaryFileFolder = (value: string): value is CloudinaryFileFolder => value === 'grnInvoices';
