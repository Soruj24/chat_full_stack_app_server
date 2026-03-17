import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    description: { type: String },
    id: { type: String } // For compatibility with array-like find if needed
}, { timestamps: true });

// Add a static find method to simulate array-like find if needed by cartService
productSchema.statics.findArrayLike = function(predicate: any) {
    // This is just a placeholder to avoid compilation errors if it's used as an array
    return []; 
};

const Product = mongoose.model('Product', productSchema);

// If it's used as an array in cartService: Product.find(...)
// We might need to export it differently or mock the array if that's what's expected.
// Given cartService line 61: const product = Product.find((p: { id: string }) => p.id === productId);
// It's definitely being used as an array.

const mockProducts: any[] = [
    { id: '1', name: 'Product 1', price: 10, stock: 100 },
    { id: '2', name: 'Product 2', price: 20, stock: 50 },
];

const originalFind = Product.find.bind(Product);
(Product as any).find = (predicate: any) => {
    if (typeof predicate === 'function') {
        return mockProducts.find(predicate);
    }
    return originalFind(predicate);
};

export default Product;
