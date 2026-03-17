// export const extractToken = (req: Request): string | null => {
//     // 1. Check Authorization header
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith("Bearer ")) {
//         return authHeader.split(" ")[1] || null;
//     }

//     // 2. Check cookies - directly get accessToken without 'Bearer' prefix
//     if ((req as any).cookies?.accessToken) {
//         return req.cookies.accessToken;
//     }

//     return null;
// };