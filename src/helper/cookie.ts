import { Response } from "express";
 
export const setAccessTokenCookie = (res: Response, accessToken: string) => {
 
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
};

export const setRefreshTokenCookie = (res: Response, token: string) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};
 
export const getBrowser = (userAgent: string): string => {
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';

    return 'Unknown';
};

export const getOS = (userAgent: string): string => {
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac OS/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iOS|iPhone|iPad/.test(userAgent)) return 'iOS';
    return 'Unknown';
};

export const getDevice = (userAgent: string): string => {
    if (/Mobile/.test(userAgent)) return 'Mobile';
    if (/Tablet|iPad/.test(userAgent)) return 'Tablet';
    return 'Desktop';
};

export const getPlatform = (userAgent: string): string => {
    return getDevice(userAgent);
};


 