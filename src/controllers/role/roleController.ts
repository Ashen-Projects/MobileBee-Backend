import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../services/auth/authService';
import * as roleService from '../../services/role/roleService';

const requestContext = (req: Request) => ({ ipAddress: req.ip });
const administrator = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listPermissions = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await roleService.listPermissions() });
};
export const listAssignableLocations = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await roleService.listAssignableLocations() });
};
export const createPermission = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.createPermission(req.body, administrator(res), requestContext(req));
  res.status(201).json({ success: true, data });
};
export const updatePermission = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.updatePermission(req.params.id, req.body, administrator(res), requestContext(req));
  res.status(200).json({ success: true, data });
};
export const deletePermission = async (req: Request, res: Response): Promise<void> => {
  await roleService.deletePermission(req.params.id, administrator(res), requestContext(req));
  res.status(200).json({ success: true, message: 'Permission deleted successfully.' });
};
export const listRoles = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await roleService.listRoles() });
};
export const getRole = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, data: await roleService.getRole(req.params.id) });
};
export const createRole = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.createRole(req.body, administrator(res), requestContext(req));
  res.status(201).json({ success: true, data });
};
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.updateRole(req.params.id, req.body, administrator(res), requestContext(req));
  res.status(200).json({ success: true, data });
};
export const replaceRolePermissions = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.replaceRolePermissions(req.params.id, req.body, administrator(res), requestContext(req));
  res.status(200).json({ success: true, data });
};
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  await roleService.deleteRole(req.params.id, administrator(res), requestContext(req));
  res.status(200).json({ success: true, message: 'Role deleted successfully.' });
};
export const replaceUserRoles = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.replaceUserRoles(req.params.id, req.body, administrator(res), requestContext(req));
  res.status(200).json({ success: true, data });
};
export const getUserRoleAssignments = async (req: Request, res: Response): Promise<void> => {
  const data = await roleService.getUserRoleAssignments(req.params.id);
  res.status(200).json({ success: true, data });
};
