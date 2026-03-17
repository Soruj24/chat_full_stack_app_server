const bcrypt = require('bcryptjs');
const saltRounds = 10;


export const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, saltRounds);
}
