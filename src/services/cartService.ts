import { v4 as uuidv4 } from 'uuid';
import { Cart, CartItem, Coupon, SavedItem, ShippingOption, TaxRate } from '../types';
import Product from '../models/productsModel';
// Note: Product and Category models are missing, creating placeholders if they don't exist
// or importing from correct location if found.


// In-memory database
const carts: Cart[] = [];


const coupons: Coupon[] = [
    { code: 'SAVE10', discountPercentage: 10, validUntil: new Date('2025-12-31') },
    { code: 'SUMMER20', discountPercentage: 20, validUntil: new Date('2025-08-31') },
];

const shippingOptions: ShippingOption[] = [
    { id: 'standard', name: 'Standard Shipping', cost: 4.99, estimatedDays: 5 },
    { id: 'express', name: 'Express Shipping', cost: 9.99, estimatedDays: 2 },
    { id: 'priority', name: 'Priority Shipping', cost: 19.99, estimatedDays: 1 },
];

const taxRates: TaxRate[] = [
    { state: 'CA', rate: 0.0825 },
    { state: 'NY', rate: 0.08875 },
    { state: 'TX', rate: 0.0625 },
];

// Helper functions
const getUserCart = async (userId: string): Promise<Cart> => {
    let cart = carts.find(c => c.userId === userId);

    if (!cart) {
        cart = {
            userId,
            items: [],
            savedItems: [],
        };
        carts.push(cart);
    }

    return cart;
};

const saveCart = async (cart: Cart): Promise<void> => {
    const index = carts.findIndex(c => c.userId === cart.userId);
    if (index !== -1) {
        carts[index] = cart;
    } else {
        carts.push(cart);
    }
};

// Service implementation
export default {
    getUserCart: async (userId: string): Promise<Cart> => {
        return getUserCart(userId);
    },

    addItemToCart: async (userId: string, productId: string, quantity: number): Promise<Cart> => {
        const cart = await getUserCart(userId);
        
        // Try to find in mock products first (for compatibility) or use Mongoose findById
        let product = (Product as any).find((p: { id: string }) => p.id === productId);
        
        if (!product) {
            product = await Product.findById(productId);
        }

        if (!product) throw new Error('Product not found');
        if (!product || (product as any).stock < quantity) throw new Error('Insufficient stock');

        const existingItem = cart.items.find((item: CartItem) => item.productId === productId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                id: uuidv4(),
                productId,
                quantity,
                price: (product as any).price,
                name: (product as any).name,
            });
        }

        await saveCart(cart);
        return cart;
    },

    updateCartItem: async (userId: string, itemId: string, quantity: number): Promise<Cart> => {
        if (quantity <= 0) throw new Error('Quantity must be at least 1');

        const cart = await getUserCart(userId);
        const item = cart.items.find((i: CartItem) => i.id === itemId);

        if (!item) throw new Error('Cart item not found');

        let product = (Product as any).find((p: { id: string }) => p.id === item.productId);
        if (!product) {
            product = await Product.findById(item.productId);
        }
        
        if (!product) throw new Error('Product not found');
        if ((product as any).stock < quantity) throw new Error('Insufficient stock');

        item.quantity = quantity;
        await saveCart(cart);
        return cart;
    },

    removeCartItem: async (userId: string, itemId: string): Promise<Cart> => {
        const cart = await getUserCart(userId);
        const initialLength = cart.items.length;

        cart.items = cart.items.filter((item: CartItem) => item.id !== itemId);

        if (cart.items.length === initialLength) {
            throw new Error('Cart item not found');
        }

        await saveCart(cart);
        return cart;
    },

    clearUserCart: async (userId: string): Promise<void> => {
        const cart = await getUserCart(userId);
        cart.items = [];
        delete cart.couponCode;
        delete cart.discountPercentage;
        await saveCart(cart);
    },

    mergeGuestCart: async (userId: string, guestCart: CartItem[]): Promise<Cart> => {
        const cart = await getUserCart(userId);

        for (const guestItem of guestCart) {
            const existingItem = cart.items.find((item: CartItem) => item.productId === guestItem.productId);

            if (existingItem) {
                existingItem.quantity += guestItem.quantity;
            } else {
                cart.items.push({ ...guestItem, id: uuidv4() });
            }
        }

        await saveCart(cart);
        return cart;
    },

    getCartItemCount: async (userId: string): Promise<number> => {
        const cart = await getUserCart(userId);
        return cart.items.reduce((total: number, item: CartItem) => total + item.quantity, 0);
    },

    applyCoupon: async (userId: string, couponCode: string): Promise<Cart> => {
        const cart = await getUserCart(userId);
        const coupon = coupons.find(c => c.code === couponCode);

        if (!coupon) throw new Error('Invalid coupon');
        if (coupon.validUntil < new Date()) throw new Error('Coupon has expired');

        cart.couponCode = coupon.code;
        cart.discountPercentage = coupon.discountPercentage;

        await saveCart(cart);
        return cart;
    },

    removeCoupon: async (userId: string): Promise<Cart> => {
        const cart = await getUserCart(userId);
        delete cart.couponCode;
        delete cart.discountPercentage;
        await saveCart(cart);
        return cart;
    },

    getShippingOptions: async (): Promise<ShippingOption[]> => {
        return shippingOptions;
    },

    calculateShipping: async (shippingMethodId: string): Promise<number> => {
        const option = shippingOptions.find(o => o.id === shippingMethodId);
        if (!option) throw new Error('Invalid shipping method');
        return option.cost;
    },

    calculateTax: async (userId: string, state: string): Promise<number> => {
        const cart = await getUserCart(userId);
        const taxRate = taxRates.find(rate => rate.state === state);

        if (!taxRate) throw new Error('Tax rate not found for state');

        const subtotal = cart.items.reduce(
            (sum: number, item: CartItem) => sum + (item.price * item.quantity), 0
        );

        const discount = cart.discountPercentage
            ? subtotal * (cart.discountPercentage / 100)
            : 0;

        const taxableAmount = subtotal - discount;
        return taxableAmount * taxRate.rate;
    },

    moveToSavedItems: async (userId: string, itemId: string): Promise<void> => {
        const cart = await getUserCart(userId);
        const itemIndex = cart.items.findIndex((item: CartItem) => item.id === itemId);

        if (itemIndex === -1) throw new Error('Cart item not found');

        const [item] = cart.items.splice(itemIndex, 1);
        cart.savedItems.push({
            id: uuidv4(),
            productId: item?.productId ?? '',
            addedAt: new Date(),
        });

        await saveCart(cart);
    },

    getSavedItems: async (userId: string): Promise<SavedItem[]> => {
        const cart = await getUserCart(userId);
        return cart.savedItems;
    },
};