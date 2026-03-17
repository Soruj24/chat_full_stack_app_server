import { UserData } from "../../types/socket";



class UserManager {
  private connectedUsers: Map<string, UserData> = new Map();

  get(socketId: string): UserData | undefined {
    return this.connectedUsers.get(socketId);
  }
 
  set(socketId: string, userData: UserData): void {
    this.connectedUsers.set(socketId, userData);
  }

  delete(socketId: string): boolean {
    return this.connectedUsers.delete(socketId);
  }

  entries(): IterableIterator<[string, UserData]> {
    return this.connectedUsers.entries();
  }

  values(): IterableIterator<UserData> {
    return this.connectedUsers.values();
  }

  getByUsername(username: string): UserData | undefined {
    for (const [socketId, userData] of this.connectedUsers.entries()) {
      if (userData.username === username) {
        return userData;
      }
    }
    return undefined;
  }

  getAllUsernames(): string[] {
    return Array.from(this.connectedUsers.values()).map(user => user.username);
  }

  getOnlineCount(): number {
    return this.connectedUsers.size;
  }

  isUserOnline(username: string): boolean {
    return this.getByUsername(username) !== undefined;
  }

  getSocketIdByUsername(username: string): string | undefined {
    const user = this.getByUsername(username);
    return user?.socketId;
  }

  getAllUsers(): UserData[] {
    return Array.from(this.connectedUsers.values());
  }

  clear(): void {
    this.connectedUsers.clear();
  }
}

export const userManager = new UserManager();
export type { UserData };