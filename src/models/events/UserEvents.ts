// models/events/UserEvents.ts
import { EventEmitter } from "events";
import { IUserDoc } from "../types/UserTypes";
import { ILoginHistory } from "../interfaces/IUser";

export class UserEvents extends EventEmitter {
  private static instance: UserEvents;

  static getInstance(): UserEvents {
    if (!UserEvents.instance) {
      UserEvents.instance = new UserEvents();
    }
    return UserEvents.instance;
  }

  emitUserCreated(user: IUserDoc) {
    this.emit('user:created', user);
  }

  emitUserLogin(user: IUserDoc, loginDetails: Partial<ILoginHistory>) {
    this.emit('user:login', user, loginDetails);
  }

  emitUserLogout(user: IUserDoc) {
    this.emit('user:logout', user);
  }

  emitProfileUpdated(user: IUserDoc, changes: string[]) {
    this.emit('user:profile_updated', user, changes);
  }

  emitPasswordChanged(user: IUserDoc) {
    this.emit('user:password_changed', user);
  }

  emitEmailVerified(user: IUserDoc) {
    this.emit('user:email_verified', user);
  }

  emitAccountLocked(user: IUserDoc) {
    this.emit('user:account_locked', user);
  }

  emitSuspiciousActivity(user: IUserDoc, activity: any) {
    this.emit('user:suspicious_activity', user, activity);
  }

  emitFriendRequestSent(fromUser: IUserDoc, toUser: IUserDoc) {
    this.emit('user:friend_request_sent', fromUser, toUser);
  }

  emitFriendRequestAccepted(user: IUserDoc, friend: IUserDoc) {
    this.emit('user:friend_request_accepted', user, friend);
  }

  emitUserBlocked(blocker: IUserDoc, blocked: IUserDoc) {
    this.emit('user:blocked', blocker, blocked);
  }

  emitUserUnblocked(unblocker: IUserDoc, unblocked: IUserDoc) {
    this.emit('user:unblocked', unblocker, unblocked);
  }
}