import { NextFunction, Request, Response } from "express";
import axios, { AxiosResponse } from "axios";
import createError from "http-errors";
import NodeCache from "node-cache";
import rateLimit from "express-rate-limit";

const ipCache = new NodeCache({ stdTTL: 3600 });

export const ipRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many IP lookup requests, please try again later.",
        error: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// IP validation utility
const isValidIP = (ip: string): boolean => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Private/Local IP detection
const isPrivateIP = (ip: string): boolean => {
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./,
        /^::1$/,
        /^fe80:/,
        /^fc00:/,
        /^fd00:/
    ];
    return privateRanges.some(range => range.test(ip));
};

// Enhanced IP detection function
const getClientIP = (req: Request): string | null => {
    const possibleHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-client-ip',
        'cf-connecting-ip',
        'x-forwarded',
        'forwarded-for',
        'forwarded',
        'x-cluster-client-ip'
    ];

    // Check headers first
    for (const header of possibleHeaders) {
        const value = req.headers[header];
        if (value) {
            let ip: string;

            if (Array.isArray(value)) {
                ip = value[0];
            } else {
                // Handle comma-separated IP lists (common in x-forwarded-for)
                ip = value.toString().split(',')[0].trim();
            }

            // Remove port if present
            ip = ip.split(':')[0];

            if (isValidIP(ip) && !isPrivateIP(ip)) {
                console.log(`Found IP from header ${header}: ${ip}`);
                return ip;
            }
        }
    }

    // Fallback to connection info - handle various formats
    let clientIP = req.ip ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;

    // Handle IPv6 mapped IPv4 and various formats
    if (clientIP) {
        if (clientIP.startsWith('::ffff:')) {
            clientIP = clientIP.substring(7);
        }
        if (clientIP === '::1') {
            clientIP = '127.0.0.1'; // Convert IPv6 localhost to IPv4
        }

        // Remove port number if present
        const ipParts = clientIP.split(':');
        if (ipParts.length > 1 && ipParts[ipParts.length - 1].match(/^\d+$/)) {
            clientIP = ipParts.slice(0, -1).join(':');
        }

        if (isValidIP(clientIP) && !isPrivateIP(clientIP)) {
            console.log(`Found IP from connection: ${clientIP}`);
            return clientIP;
        }
    }

    console.log('No valid public IP found in headers or connection');
    return null;
};

// Multiple IP service providers for redundancy
const ipServiceProviders = [
    {
        name: 'ipapi.co',
        url: (ip: string) => `https://ipapi.co/${ip}/json/`,
        timeout: 5000,
        parser: (data: any) => ({
            ip: data.ip,
            city: data.city,
            region: data.region,
            region_code: data.region_code,
            country: data.country_name,
            country_code: data.country_code,
            postal: data.postal,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone,
            utc_offset: data.utc_offset,
            country_calling_code: data.country_calling_code,
            currency: data.currency,
            languages: data.languages,
            asn: data.asn,
            org: data.org,
            isp: data.org,
            threat: {
                is_tor: data.threat?.is_tor || false,
                is_proxy: data.threat?.is_proxy || false,
                is_anonymous: data.threat?.is_anonymous || false,
                is_known_attacker: data.threat?.is_known_attacker || false,
                is_known_abuser: data.threat?.is_known_abuser || false,
                is_threat: data.threat?.is_threat || false,
                is_bogon: data.threat?.is_bogon || false
            }
        })
    },
    {
        name: 'ip-api.com',
        url: (ip: string) => `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
        timeout: 5000,
        parser: (data: any) => ({
            ip: data.query,
            city: data.city,
            region: data.regionName,
            region_code: data.region,
            country: data.country,
            country_code: data.countryCode,
            postal: data.zip,
            latitude: data.lat,
            longitude: data.lon,
            timezone: data.timezone,
            utc_offset: data.offset,
            currency: data.currency,
            asn: data.as,
            org: data.org,
            isp: data.isp,
            threat: {
                is_proxy: data.proxy || false,
                is_hosting: data.hosting || false,
                is_mobile: data.mobile || false
            }
        })
    }
];

// Enhanced public IP fallback with multiple providers
const getPublicIP = async (): Promise<string> => {
    const fallbackProviders = [
        {
            name: 'ipify',
            url: 'https://api.ipify.org?format=json',
            timeout: 3000,
            parser: (data: any) => data.ip
        },
        {
            name: 'icanhazip',
            url: 'https://icanhazip.com',
            timeout: 3000,
            parser: (data: any) => data.trim()
        },
        {
            name: 'jsonip',
            url: 'https://jsonip.com',
            timeout: 3000,
            parser: (data: any) => data.ip
        }
    ];

    for (const provider of fallbackProviders) {
        try {
            const response = await axios.get(provider.url, {
                timeout: provider.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; IP-Lookup-Service/1.0)',
                    'Accept': 'application/json'
                }
            });

            const ip = provider.parser(response.data);
            if (isValidIP(ip)) {
                console.log(`Got public IP from ${provider.name}: ${ip}`);
                return ip;
            }
        } catch (error: any) {
            console.warn(`Failed to get IP from ${provider.name}:`, error.message);
        }
    }

    throw new Error('Failed to get public IP from any provider');
};

// Fetch IP info with retry logic
const fetchIPInfo = async (ip: string): Promise<any> => {
    const errors: string[] = [];

    for (const provider of ipServiceProviders) {
        try {
            const response: AxiosResponse = await axios.get(provider.url(ip), {
                timeout: provider.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; IP-Lookup-Service/1.0)',
                    'Accept': 'application/json'
                }
            });

            if (response.status === 200 && response.data) {
                return provider.parser(response.data);
            }
        } catch (error: any) {
            errors.push(`${provider.name}: ${error.message}`);
            console.warn(`Failed to fetch from ${provider.name}:`, error.message);
        }
    }

    throw new Error(`All IP service providers failed. Errors: ${errors.join(', ')}`);
};

// Security headers and additional info
const addSecurityInfo = (ipInfo: any, req: Request): any => {
    return {
        ...ipInfo,
        request_info: {
            user_agent: req.headers['user-agent'] || 'Unknown',
            accept_language: req.headers['accept-language'] || 'Unknown',
            referer: req.headers['referer'] || 'Direct',
            timestamp: new Date().toISOString(),
            method: req.method,
            endpoint: req.originalUrl
        },
        security: {
            is_tor: ipInfo.threat?.is_tor || false,
            is_proxy: ipInfo.threat?.is_proxy || false,
            is_vpn: ipInfo.threat?.is_anonymous || false,
            risk_score: calculateRiskScore(ipInfo)
        }
    };
};

// Get climate zone based on latitude
const getClimateZone = (latitude: number): string => {
    const lat = Math.abs(latitude);
    if (lat >= 66.5) return 'Polar';
    if (lat >= 60) return 'Subarctic';
    if (lat >= 45) return 'Continental';
    if (lat >= 30) return 'Subtropical';
    if (lat >= 23.5) return 'Tropical';
    return 'Equatorial';
};

const calculateRiskScore = (ipInfo: any): number => {
    let score = 0;
    if (ipInfo.threat?.is_tor) score += 30;
    if (ipInfo.threat?.is_proxy) score += 20;
    if (ipInfo.threat?.is_anonymous) score += 15;
    if (ipInfo.threat?.is_known_attacker) score += 50;
    if (ipInfo.threat?.is_known_abuser) score += 40;
    return Math.min(score, 100);
};

export const advancedIPController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log('Attempting to get client IP...');

        // Get client IP
        let clientIP = getClientIP(req);

        // If no valid public IP found, get external IP
        if (!clientIP) {
            console.log('No client IP found, trying public IP...');
            try {
                clientIP = await getPublicIP();
                console.log('Using public IP:', clientIP);
            } catch (error) {
                console.error('Failed to get public IP:', error);
                // For development, use a fallback IP
                if (process.env.NODE_ENV === 'development') {
                    clientIP = '8.8.8.8'; // Google DNS as fallback for dev
                    console.log('Using development fallback IP:', clientIP);
                } else {
                    return next(createError(400, "Unable to determine IP address"));
                }
            }
        }

        // Check cache first
        const cacheKey = `ip_info_${clientIP}`;
        let ipInfo = ipCache.get(cacheKey);

        if (!ipInfo) {
            // Fetch IP information
            ipInfo = await fetchIPInfo(clientIP);

            // Cache the result
            ipCache.set(cacheKey, ipInfo);
        }

        // Add security and request information
        const enrichedInfo = addSecurityInfo(ipInfo, req);

        // Add climate zone if latitude is available
        if (enrichedInfo.latitude) {
            enrichedInfo.climate_zone = getClimateZone(enrichedInfo.latitude);
        }

        // Response with comprehensive information
        res.status(200).json({
            success: true,
            message: "IP information fetched successfully",
            data: enrichedInfo,
            meta: {
                cached: ipCache.has(cacheKey),
                processing_time: Date.now() - (req as any).startTime,
                api_version: "2.0",
                rate_limit: {
                    remaining: res.getHeaders()['x-ratelimit-remaining'],
                    reset: res.getHeaders()['x-ratelimit-reset']
                }
            }
        });

    } catch (error: any) {
        console.error("Error in IP controller:", error);

        // Enhanced error handling
        if (error.code === 'ENOTFOUND') {
            return next(createError(503, "IP lookup service unavailable"));
        } else if (error.code === 'ECONNABORTED') {
            return next(createError(408, "Request timeout - IP lookup service is slow"));
        } else if (error.response?.status === 429) {
            return next(createError(429, "IP lookup service rate limit exceeded"));
        } else {
            return next(createError(500, "Failed to fetch IP information"));
        }
    }
};

// Middleware to add request start time
export const addRequestStartTime = (req: Request, res: Response, next: NextFunction) => {
    (req as any).startTime = Date.now();
    next();
};

// Debug middleware for troubleshooting
export const debugIPMiddleware = (req: Request, res: Response, next: NextFunction) => {
    console.log('=== IP DEBUG INFO ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('req.ip:', req.ip);
    console.log('req.connection.remoteAddress:', req.connection?.remoteAddress);
    console.log('req.socket.remoteAddress:', req.socket?.remoteAddress);
    console.log('========================');
    next();
};

// Bulk IP lookup endpoint
export const bulkIPController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ips } = req.body;

        if (!Array.isArray(ips) || ips.length === 0) {
            return next(createError(400, "Please provide an array of IP addresses"));
        }

        if (ips.length > 10) {
            return next(createError(400, "Maximum 10 IPs allowed per request"));
        }

        const results = await Promise.allSettled(
            ips.map(async (ip: string) => {
                if (!isValidIP(ip)) {
                    throw new Error(`Invalid IP address: ${ip}`);
                }

                const cacheKey = `ip_info_${ip}`;
                let ipInfo = ipCache.get(cacheKey);

                if (!ipInfo) {
                    ipInfo = await fetchIPInfo(ip);
                    ipCache.set(cacheKey, ipInfo);
                }

                return { ip, data: ipInfo, status: 'success' };
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as any).value);
        const failed = results.filter(r => r.status === 'rejected').map((r, index) => ({
            ip: ips[index],
            error: (r as any).reason.message,
            status: 'failed'
        }));

        res.status(200).json({
            success: true,
            message: `Processed ${ips.length} IP addresses`,
            data: {
                successful,
                failed,
                summary: {
                    total: ips.length,
                    success_count: successful.length,
                    failed_count: failed.length
                }
            }
        });

    } catch (error) {
        console.error("Error in bulk IP controller:", error);
        next(createError(500, "Failed to process bulk IP lookup"));
    }
};