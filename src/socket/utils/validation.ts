export const validateJoinData = (username: string, language: string): string | null => {
    if (!username || !language) {
        return "Username and language are required";
    }

    if (username.length < 3 || username.length > 20) {
        return "Username must be between 3 and 20 characters";
    }

    // Add more validation as needed

    return null;
};