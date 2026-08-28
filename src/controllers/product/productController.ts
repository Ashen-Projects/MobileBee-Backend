import type {Request, Response} from 'express';

import type {AuthenticatedUser} from '../../services/auth/authService';
import * as catalogService from '../../services/product/productCatalogService';
import * as productService from '../../services/product/productService';

const requestContext = (req: Request) => ({ipAddress: req.ip});
const user = (res: Response) => res.locals.auth as AuthenticatedUser;

export const listProducts = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({success: true, data: await productService.listProducts(req.query)});
};
export const getProduct = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({success: true, data: await productService.getProduct(req.params.id)});
};
export const createProduct = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
        success: true,
        data: await productService.createProduct(req.body, user(res), requestContext(req))
    });
};
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await productService.updateProduct(req.params.id, req.body, user(res), requestContext(req))
    });
};
export const setProductStatus = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await productService.setProductStatus(req.params.id, req.body, user(res), requestContext(req))
    });
};

export const listCategories = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({success: true, data: await catalogService.listCategories(req.query)});
};
export const createCategory = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
        success: true,
        data: await catalogService.createCategory(req.body, user(res), requestContext(req))
    });
};
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.updateCategory(req.params.id, req.body, user(res), requestContext(req))
    });
};
export const setCategoryStatus = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.setCategoryStatus(req.params.id, req.body, user(res), requestContext(req))
    });
};

export const listAttributes = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({success: true, data: await catalogService.listAttributes(req.query)});
};
export const createAttribute = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
        success: true,
        data: await catalogService.createAttribute(req.body, user(res), requestContext(req))
    });
};
export const updateAttribute = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.updateAttribute(req.params.id, req.body, user(res), requestContext(req))
    });
};
export const setAttributeStatus = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.setAttributeStatus(req.params.id, req.body, user(res), requestContext(req))
    });
};
export const createAttributeOption = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({
        success: true,
        data: await catalogService.createAttributeOption(req.params.attributeId, req.body, user(res), requestContext(req))
    });
};
export const updateAttributeOption = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.updateAttributeOption(req.params.id, req.body, user(res), requestContext(req))
    });
};
export const setAttributeOptionStatus = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        data: await catalogService.setAttributeOptionStatus(req.params.id, req.body, user(res), requestContext(req))
    });
};
