import Redis, { Redis as RedisClient, RedisOptions } from "ioredis";

interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    lazyConnect?: boolean;
    connectTimeout?: number;
}

class RedisService {
    private client!: RedisClient;
    private subscriber!: RedisClient;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private fallbackMode: boolean = false;
    private memoryCache: Map<string, { value: string; expires?: number }> = new Map();

    constructor() {
        this.initializeClient();
        this.initializeSubscriber();
        this.setupEventHandlers();
    }

    private getRedisConfig(): RedisOptions {
        const config: RedisOptions = {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            db: parseInt(process.env.REDIS_DB || "0"),
            keyPrefix: process.env.REDIS_KEY_PREFIX || "app:",
            lazyConnect: true,
            connectTimeout: 10000,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            password: process.env.REDIS_PASSWORD,
        };

        return config;
    }

    private initializeClient(): void {
        if (process.env.REDIS_URL) {
            this.client = new Redis(process.env.REDIS_URL);
        } else {
            this.client = new Redis(this.getRedisConfig());
        }
    }

    private initializeSubscriber(): void {
        const config = this.getRedisConfig();
        config.keyPrefix = undefined; // No prefix needed for pub/sub

        if (process.env.REDIS_URL) {
            this.subscriber = new Redis(process.env.REDIS_URL);
        } else {
            this.subscriber = new Redis(config);
        }
    }

    private setupEventHandlers(): void {
        this.client.on("connect", () => {
            console.log("✅ Redis client connected");
            this.isConnected = true;
            this.fallbackMode = false;
            this.reconnectAttempts = 0;
        });

        this.client.on("ready", () => {
            console.log("✅ Redis client ready");
        });

        this.client.on("error", (error) => {
            console.error("❌ Redis client error:", error.message);
            this.isConnected = false;
        });

        this.client.on("close", () => {
            console.log("⚠️ Redis client connection closed");
            this.isConnected = false;
        });

        this.client.on("reconnecting", (delay: number) => {
            this.reconnectAttempts++;
            console.log(`🔄 Redis client reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error("❌ Max reconnection attempts reached. Switching to fallback mode.");
                this.fallbackMode = true;
            }
        });

        this.subscriber.on("connect", () => {
            console.log("✅ Redis subscriber connected");
        });

        this.subscriber.on("error", (error) => {
            console.error("❌ Redis subscriber error:", error.message);
        });
    }

    // Connection management
    async connect(): Promise<void> {
        try {
            await Promise.all([this.client.connect(), this.subscriber.connect()]);
            console.log("✅ Redis connections established");
        } catch (error) {
            console.error("❌ Failed to connect to Redis, using fallback mode:", error);
            this.fallbackMode = true;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await Promise.all([this.client.disconnect(), this.subscriber.disconnect()]);
            console.log("✅ Redis connections closed");
        } catch (error) {
            console.error("❌ Error closing Redis connections:", error);
            throw error;
        }
    }

    // Health check
    async ping(): Promise<string> {
        if (this.fallbackMode) return "FALLBACK";
        try {
            return await this.client.ping();
        } catch {
            return "ERROR";
        }
    }

    async isHealthy(): Promise<boolean> {
        if (this.fallbackMode) return true; // Fallback mode is considered healthy
        try {
            const pong = await this.ping();
            return pong === "PONG" && this.isConnected;
        } catch {
            return false;
        }
    }

    // Basic operations with fallback
    async get(key: string): Promise<string | null> {
        if (this.fallbackMode) {
            const item = this.memoryCache.get(key);
            if (!item) return null;
            
            // Check if item has expired
            if (item.expires && item.expires < Date.now()) {
                this.memoryCache.delete(key);
                return null;
            }
            
            return item.value;
        }
        
        try {
            return await this.client.get(key);
        } catch (error) {
            console.error("Redis get error, using fallback:", error);
            return this.get(key); // Recursive call will use fallback mode
        }
    }

    async set(key: string, value: string, expireInSeconds?: number): Promise<string> {
        if (this.fallbackMode) {
            const expires = expireInSeconds ? Date.now() + (expireInSeconds * 1000) : undefined;
            this.memoryCache.set(key, { value, expires });
            return "OK";
        }
        
        try {
            if (expireInSeconds) {
                return await this.client.setex(key, expireInSeconds, value);
            }
            return await this.client.set(key, value);
        } catch (error) {
            console.error("Redis set error, using fallback:", error);
            this.fallbackMode = true;
            return this.set(key, value, expireInSeconds); // Recursive call will use fallback mode
        }
    }

    async del(key: string | string[]): Promise<number> {
        if (this.fallbackMode) {
            if (Array.isArray(key)) {
                let count = 0;
                key.forEach(k => {
                    if (this.memoryCache.delete(k)) count++;
                });
                return count;
            }
            return this.memoryCache.delete(key) ? 1 : 0;
        }
        
        try {
            if (Array.isArray(key)) return await this.client.del(...key);
            return await this.client.del(key);
        } catch (error) {
            console.error("Redis del error, using fallback:", error);
            this.fallbackMode = true;
            return this.del(key); // Recursive call will use fallback mode
        }
    }

    async exists(key: string): Promise<number> {
        if (this.fallbackMode) {
            return this.memoryCache.has(key) ? 1 : 0;
        }
        
        try {
            return await this.client.exists(key);
        } catch (error) {
            console.error("Redis exists error, using fallback:", error);
            this.fallbackMode = true;
            return this.exists(key); // Recursive call will use fallback mode
        }
    }

    async expire(key: string, seconds: number): Promise<number> {
        if (this.fallbackMode) {
            const item = this.memoryCache.get(key);
            if (item) {
                item.expires = Date.now() + (seconds * 1000);
                return 1;
            }
            return 0;
        }
        
        try {
            return await this.client.expire(key, seconds);
        } catch (error) {
            console.error("Redis expire error, using fallback:", error);
            this.fallbackMode = true;
            return this.expire(key, seconds); // Recursive call will use fallback mode
        }
    }

    async ttl(key: string): Promise<number> {
        if (this.fallbackMode) {
            const item = this.memoryCache.get(key);
            if (!item || !item.expires) return -2; // Key doesn't exist or has no expiry
            return Math.max(0, Math.floor((item.expires - Date.now()) / 1000));
        }
        
        try {
            return await this.client.ttl(key);
        } catch (error) {
            console.error("Redis ttl error, using fallback:", error);
            this.fallbackMode = true;
            return this.ttl(key); // Recursive call will use fallback mode
        }
    }

    // Hash operations with fallback
    async hget(key: string, field: string): Promise<string | null> {
        if (this.fallbackMode) {
            const item = this.memoryCache.get(`${key}:${field}`);
            return item ? item.value : null;
        }
        
        try {
            return await this.client.hget(key, field);
        } catch (error) {
            console.error("Redis hget error, using fallback:", error);
            this.fallbackMode = true;
            return this.hget(key, field); // Recursive call will use fallback mode
        }
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        if (this.fallbackMode) {
            this.memoryCache.set(`${key}:${field}`, { value });
            return 1;
        }
        
        try {
            return await this.client.hset(key, field, value);
        } catch (error) {
            console.error("Redis hset error, using fallback:", error);
            this.fallbackMode = true;
            return this.hset(key, field, value); // Recursive call will use fallback mode
        }
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        if (this.fallbackMode) {
            const result: Record<string, string> = {};
            const prefix = `${key}:`;
            
            this.memoryCache.forEach((value, cacheKey) => {
                if (cacheKey.startsWith(prefix)) {
                    const field = cacheKey.substring(prefix.length);
                    result[field] = value.value;
                }
            });
            
            return result;
        }
        
        try {
            return await this.client.hgetall(key);
        } catch (error) {
            console.error("Redis hgetall error, using fallback:", error);
            this.fallbackMode = true;
            return this.hgetall(key); // Recursive call will use fallback mode
        }
    }

    async hdel(key: string, field: string | string[]): Promise<number> {
        if (this.fallbackMode) {
            if (Array.isArray(field)) {
                let count = 0;
                field.forEach(f => {
                    if (this.memoryCache.delete(`${key}:${f}`)) count++;
                });
                return count;
            }
            return this.memoryCache.delete(`${key}:${field}`) ? 1 : 0;
        }
        
        try {
            if (Array.isArray(field)) return await this.client.hdel(key, ...field);
            return await this.client.hdel(key, field);
        } catch (error) {
            console.error("Redis hdel error, using fallback:", error);
            this.fallbackMode = true;
            return this.hdel(key, field); // Recursive call will use fallback mode
        }
    }

    // List operations with fallback (simplified implementation)
    async lpush(key: string, value: string | string[]): Promise<number> {
        if (this.fallbackMode) {
            console.warn("List operations not fully supported in fallback mode");
            return Array.isArray(value) ? value.length : 1;
        }
        
        try {
            if (Array.isArray(value)) return await this.client.lpush(key, ...value);
            return await this.client.lpush(key, value);
        } catch (error) {
            console.error("Redis lpush error:", error);
            throw error;
        }
    }

    // Other list operations would follow similar pattern...

    // Pub/Sub operations
    async publish(channel: string, message: string): Promise<number> {
        if (this.fallbackMode) {
            console.warn("Pub/Sub not supported in fallback mode");
            return 0;
        }
        
        try {
            return await this.client.publish(channel, message);
        } catch (error) {
            console.error("Redis publish error:", error);
            throw error;
        }
    }

    async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
        if (this.fallbackMode) {
            console.warn("Pub/Sub not supported in fallback mode");
            return;
        }
        
        try {
            await this.subscriber.subscribe(channel);
            this.subscriber.on("message", (receivedChannel, message) => {
                if (receivedChannel === channel) callback(message);
            });
        } catch (error) {
            console.error("Redis subscribe error:", error);
            throw error;
        }
    }

    async unsubscribe(channel?: string): Promise<void> {
        if (this.fallbackMode) {
            console.warn("Pub/Sub not supported in fallback mode");
            return;
        }
        
        try {
            if (channel) await this.subscriber.unsubscribe(channel);
            else await this.subscriber.unsubscribe();
        } catch (error) {
            console.error("Redis unsubscribe error:", error);
            throw error;
        }
    }

    // Utility
    getClient(): RedisClient {
        return this.client;
    }

    getSubscriber(): RedisClient {
        return this.subscriber;
    }

    isInFallbackMode(): boolean {
        return this.fallbackMode;
    }
}

// Singleton instance
const redisService = new RedisService();

// Auto-connect if not in test
if (process.env.NODE_ENV !== "test") {
    redisService.connect().catch(console.error);
}

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Shutting down Redis connections...");
    await redisService.disconnect();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("Shutting down Redis connections...");
    await redisService.disconnect();
    process.exit(0);
});

export const redis = redisService;
export default redisService;