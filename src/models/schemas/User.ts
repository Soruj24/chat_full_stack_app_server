import mongoose from "mongoose";
import { applyUserHooks } from "../hooks/userHooks";
import { UserSchema } from "./UserSchema";
import { applyUserMethods } from "../methods/userMethods";
import { applyUserStatics } from "../statics/userStatics";
import { applyUserVirtuals } from "../virtuals/userVirtuals";
import { UserEvents } from "../events/UserEvents";
import { IUserDoc, UserModel } from "../types/UserTypes";

// Apply all plugins and methods
applyUserHooks(UserSchema);
applyUserMethods(UserSchema);
applyUserStatics(UserSchema);
applyUserVirtuals(UserSchema);

// Add event emitter plugin
UserSchema.plugin(function (schema: mongoose.Schema<IUserDoc, UserModel>) {
  const userEvents = UserEvents.getInstance();

  schema.post('save', function (doc: IUserDoc) {
    if (doc.isNew) {
      userEvents.emitUserCreated(doc);
    }
  });

  // Add event emission methods
  schema.methods.emitLogin = function (loginDetails: any) {
    const userEvents = UserEvents.getInstance();
    userEvents.emitUserLogin(this as IUserDoc, loginDetails);
  };

  schema.methods.emitLogout = function () {
    const userEvents = UserEvents.getInstance();
    userEvents.emitUserLogout(this as IUserDoc);
  };

  schema.methods.emitProfileUpdated = function (changes: string[]) {
    const userEvents = UserEvents.getInstance();
    userEvents.emitProfileUpdated(this as IUserDoc, changes);
  };

  schema.methods.emitPasswordChanged = function () {
    const userEvents = UserEvents.getInstance();
    userEvents.emitPasswordChanged(this as IUserDoc);
  };

  schema.methods.emitEmailVerified = function () {
    const userEvents = UserEvents.getInstance();
    userEvents.emitEmailVerified(this as IUserDoc);
  };
});

// Create the User model
const User: UserModel = mongoose.model<IUserDoc, UserModel>('User', UserSchema);

// Export everything
export default User;
export { User };