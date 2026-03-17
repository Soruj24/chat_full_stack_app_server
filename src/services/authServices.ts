import { hashPassword } from "../helper/hashPassword";
import { CreateUserBody } from "../types";
import User from "../models/schemas/User";

export const createUser = async (userData: CreateUserBody) => {
    try {
        
        const hashedPassword = await hashPassword(userData.password);
        const newUser = {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            password: hashedPassword,
            gender: userData.gender,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : null,
            addresses: userData.addresses,
            preferences: userData.preferences,
            twoFactorAuth: { backupCodes: [] },
            role: 'user',
            isEmailVerified: false,
            status: 'pending',
            avatar: '',
        };

        const savedUser = await User.create(newUser);



        const user = savedUser.toObject();
        return user;
    } catch (error) {
        throw new Error("Error creating user");
    }
};
