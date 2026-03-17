import createHttpError from "http-errors";
import Category from "../models/categoryModel";

export const findCategory = async (id: string | undefined) => {
    try {
        // Validate ID format first
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            throw createHttpError(400, "Invalid category ID format");
        }

        // Now find the category
        const category = await Category.findById(id);

        if (!category) {
            throw createHttpError(404, "Category not found");
        }

        return category;
    } catch (error) {
        throw error; // Let the calling function handle the error
    }
};
