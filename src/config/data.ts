import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Gender, UserRole, UserStatus, Permission } from "../models/interfaces/IUser";

// Reserved usernames that should be avoided
const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "system",
  "null",
  "undefined",
  "api",
  "www",
  "support",
  "help",
  "contact",
  "test",
  "moderator",
  "guest",
  "anonymous",
  "user",
  "users",
  "settings",
  "config",
];

// Unsplash Image Helper Functions
const getUnsplashAvatar = (): string => {
  return `https://images.unsplash.com/photo-${faker.helpers.arrayElement([
    "1472099645785-5658abf4ff4e",
    "1494790108755-2616c60b6635",
    "1507003211169-0a1dd7228f2d",
    "1517841905240-472988babdf9",
    "1573496359142-b8d87734a5a2",
    "1560250097-0b93528c311a",
  ])}?w=150&h=150&fit=crop&crop=face`;
};

// Custom phone number generator that always returns valid numbers
const generateValidPhoneNumber = (): string => {
  const bangladeshNumbers = [
    "+8801312345678",
    "+8801412345678",
    "+8801512345678",
    "+8801612345678",
    "+8801712345678",
    "+8801812345678",
    "+8801912345678",
    "+8801321234567",
    "+8801421234567",
    "+8801521234567",
    "+8801621234567",
    "+8801721234567",
    "+8801821234567",
    "+8801921234567",
  ];

  return faker.helpers.arrayElement(bangladeshNumbers);
};

// Custom username generator that avoids reserved usernames
const generateValidUsername = (): string => {
  let username: string;
  let attempts = 0;

  do {
    // Generate a username
    username = faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .substring(0, 30); // Ensure it doesn't exceed max length

    // Add some random characters if it's a reserved username
    if (RESERVED_USERNAMES.includes(username)) {
      username = username + faker.string.numeric(2);
    }

    attempts++;

    // Prevent infinite loop
    if (attempts > 10) {
      username = `user_${faker.string.alphanumeric(8)}`;
      break;
    }
  } while (RESERVED_USERNAMES.includes(username));

  return username;
};

// Password Helper
const generateHashedPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// USER GENERATION
const generateMockUsers = async (): Promise<any[]> => {
  const users: any[] = [];
  const usedUsernames = new Set<string>();
  const usedEmails = new Set<string>();

  // Generate admin users first
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    username: "admin_user",
    email: "admin@example.com",
    password: await generateHashedPassword("admin123"),
    firstName: "System",
    lastName: "Administrator",
    displayName: "System Administrator",
    avatar: {
      url: getUnsplashAvatar(),
      publicId: `avatar-admin-${faker.string.uuid()}`,
    },
    role: UserRole.ADMIN,
    permissions: [
      Permission.USERS_VIEW,
      Permission.USERS_CREATE,
      Permission.USERS_EDIT,
      Permission.ANALYTICS_VIEW,
    ],
    status: UserStatus.ACTIVE,
    isVerified: true,
    emailVerified: true,
    isActive: true,
    phone: generateValidPhoneNumber(),
    phoneVerified: true,
    gender: Gender.MALE,
    dateOfBirth: new Date("1985-01-01"),
    userLanguage: "en",
    timezone: "UTC",
    registrationIP: faker.internet.ipv4(),
    detectedCountry: "BD",
    preferences: {
      notifications: {
        email: true,
        sms: false,
        push: true,
        marketing: false,
        security: true,
        social: true,
        system: true,
      },
      privacy: {
        profileVisibility: "public",
        showEmail: false,
        showPhone: false,
        showOnlineStatus: true,
        showLastSeen: true,
        allowFriendRequests: true,
        allowDirectMessages: true,
        searchable: true,
      },
      security: {
        requireTwoFactorForPasswordChange: true,
        requireTwoFactorForEmailChange: true,
        sessionTimeout: 60,
        allowMultipleSessions: true,
        suspiciousActivityAlerts: true,
      },
      language: "en",
      currency: "USD",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24",
    },
    addresses: [
      {
        type: "home",
        street: "123 Admin Street",
        city: "Dhaka",
        state: "Dhaka",
        country: "Bangladesh",
        zipCode: "1200",
        isDefault: true,
      },
    ],
    loginCount: faker.number.int({ min: 50, max: 200 }),
    lastLoginAt: new Date(),
    accountCreatedAt: new Date(),
    metadata: {
      userAgent: faker.internet.userAgent(),
      initialCountry: "BD",
      signupFlow: "direct",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(adminUser);
  usedUsernames.add("admin_user");
  usedEmails.add("admin@example.com");

  // Generate super admin
  const superAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    username: "super_admin",
    email: "superadmin@example.com",
    password: await generateHashedPassword("superadmin123"),
    firstName: "Super",
    lastName: "Admin",
    displayName: "Super Admin",
    avatar: {
      url: getUnsplashAvatar(),
      publicId: `avatar-superadmin-${faker.string.uuid()}`,
    },
    role: UserRole.SUPER_ADMIN,
    permissions: Object.values(Permission),
    status: UserStatus.ACTIVE,
    isVerified: true,
    emailVerified: true,
    isActive: true,
    phone: generateValidPhoneNumber(),
    phoneVerified: true,
    gender: Gender.MALE,
    dateOfBirth: new Date("1980-01-01"),
    userLanguage: "en",
    timezone: "UTC",
    registrationIP: faker.internet.ipv4(),
    detectedCountry: "BD",
    preferences: {
      notifications: {
        email: true,
        sms: false,
        push: true,
        marketing: false,
        security: true,
        social: true,
        system: true,
      },
      privacy: {
        profileVisibility: "private",
        showEmail: false,
        showPhone: false,
        showOnlineStatus: true,
        showLastSeen: false,
        allowFriendRequests: false,
        allowDirectMessages: false,
        searchable: false,
      },
      security: {
        requireTwoFactorForPasswordChange: true,
        requireTwoFactorForEmailChange: true,
        sessionTimeout: 30,
        allowMultipleSessions: false,
        suspiciousActivityAlerts: true,
      },
      language: "en",
      currency: "USD",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24",
    },
    addresses: [
      {
        type: "work",
        street: "456 Super Admin Ave",
        city: "Dhaka",
        state: "Dhaka",
        country: "Bangladesh",
        zipCode: "1200",
        isDefault: true,
      },
    ],
    loginCount: faker.number.int({ min: 100, max: 300 }),
    lastLoginAt: new Date(),
    accountCreatedAt: new Date(),
    metadata: {
      userAgent: faker.internet.userAgent(),
      initialCountry: "BD",
      signupFlow: "direct",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(superAdminUser);
  usedUsernames.add("super_admin");
  usedEmails.add("superadmin@example.com");

  // Generate moderator
  const moderatorUser = {
    _id: new mongoose.Types.ObjectId(),
    username: "moderator_user",
    email: "moderator@example.com",
    password: await generateHashedPassword("moderator123"),
    firstName: "System",
    lastName: "Moderator",
    displayName: "System Moderator",
    avatar: {
      url: getUnsplashAvatar(),
      publicId: `avatar-moderator-${faker.string.uuid()}`,
    },
    role: UserRole.MODERATOR,
    permissions: [
      Permission.USERS_VIEW,
      Permission.CONTENT_VIEW,
      Permission.CONTENT_CREATE,
      Permission.CONTENT_EDIT,
      Permission.TICKETS_VIEW,
      Permission.TICKETS_EDIT,
    ],
    status: UserStatus.ACTIVE,
    isVerified: true,
    emailVerified: true,
    isActive: true,
    phone: generateValidPhoneNumber(),
    phoneVerified: true,
    gender: Gender.FEMALE,
    dateOfBirth: new Date("1990-01-01"),
    userLanguage: "en",
    timezone: "UTC",
    registrationIP: faker.internet.ipv4(),
    detectedCountry: "BD",
    preferences: {
      notifications: {
        email: true,
        sms: true,
        push: true,
        marketing: false,
        security: true,
        social: true,
        system: true,
      },
      privacy: {
        profileVisibility: "public",
        showEmail: false,
        showPhone: false,
        showOnlineStatus: true,
        showLastSeen: true,
        allowFriendRequests: true,
        allowDirectMessages: true,
        searchable: true,
      },
      security: {
        requireTwoFactorForPasswordChange: true,
        requireTwoFactorForEmailChange: false,
        sessionTimeout: 60,
        allowMultipleSessions: true,
        suspiciousActivityAlerts: true,
      },
      language: "en",
      currency: "USD",
      timezone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24",
    },
    addresses: [
      {
        type: "work",
        street: "789 Mod Plaza",
        city: "Dhaka",
        state: "Dhaka",
        country: "Bangladesh",
        zipCode: "1200",
        isDefault: true,
      },
    ],
    loginCount: faker.number.int({ min: 20, max: 100 }),
    lastLoginAt: new Date(),
    accountCreatedAt: new Date(),
    metadata: {
      userAgent: faker.internet.userAgent(),
      initialCountry: "BD",
      signupFlow: "direct",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(moderatorUser);
  usedUsernames.add("moderator_user");
  usedEmails.add("moderator@example.com");

  // Generate regular users
  const NUM_USERS = 50;
  for (let i = 0; i < NUM_USERS - 3; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    // Generate unique username
    let username: string;
    let attempts = 0;

    do {
      username = generateValidUsername();
      attempts++;

      // If we can't generate a unique username after several attempts, create a custom one
      if (attempts > 5) {
        username = `user_${firstName.toLowerCase()}_${faker.string.numeric(4)}`;
      }
    } while (usedUsernames.has(username) && attempts < 10);

    usedUsernames.add(username);

    // Generate unique email
    let email: string;
    attempts = 0;

    do {
      email = faker.internet.email({ firstName, lastName }).toLowerCase();
      attempts++;

      if (attempts > 5) {
        email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.string.numeric(
          3
        )}@example.com`;
      }
    } while (usedEmails.has(email) && attempts < 10);

    usedEmails.add(email);

    users.push({
      _id: new mongoose.Types.ObjectId(),
      username: username,
      email: email,
      password: await generateHashedPassword("password123"),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      avatar: {
        url: getUnsplashAvatar(),
        publicId: `avatar-${faker.string.uuid()}`,
      },
      role: faker.helpers.arrayElement([UserRole.USER, UserRole.PREMIUM]),
      permissions: [],
      status: UserStatus.ACTIVE,
      isVerified: faker.datatype.boolean(0.8),
      emailVerified: faker.datatype.boolean(0.8),
      isActive: true,
      phone: generateValidPhoneNumber(),
      phoneVerified: faker.datatype.boolean(0.6),
      gender: faker.helpers.arrayElement(Object.values(Gender)),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 70, mode: "age" }),
      bio: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : undefined,
      userLanguage: faker.helpers.arrayElement(["en", "bn", "hi", "ur"]),
      timezone: faker.helpers.arrayElement([
        "UTC",
        "America/New_York",
        "Europe/London",
        "Asia/Dhaka",
      ]),
      registrationIP: faker.internet.ipv4(),
      detectedCountry: faker.location.countryCode("alpha-2"),
      preferences: {
        notifications: {
          email: faker.datatype.boolean(0.8),
          sms: faker.datatype.boolean(0.3),
          push: faker.datatype.boolean(0.7),
          marketing: faker.datatype.boolean(0.2),
          security: faker.datatype.boolean(0.9),
          social: faker.datatype.boolean(0.6),
          system: faker.datatype.boolean(0.5),
        },
        privacy: {
          profileVisibility: faker.helpers.arrayElement([
            "public",
            "friends",
            "private",
          ]),
          showEmail: false,
          showPhone: false,
          showOnlineStatus: faker.datatype.boolean(0.7),
          showLastSeen: faker.datatype.boolean(0.6),
          allowFriendRequests: faker.datatype.boolean(0.8),
          allowDirectMessages: faker.datatype.boolean(0.7),
          searchable: faker.datatype.boolean(0.9),
        },
        security: {
          requireTwoFactorForPasswordChange: faker.datatype.boolean(0.3),
          requireTwoFactorForEmailChange: faker.datatype.boolean(0.2),
          sessionTimeout: faker.helpers.arrayElement([30, 60, 120, 180]),
          allowMultipleSessions: faker.datatype.boolean(0.8),
          suspiciousActivityAlerts: faker.datatype.boolean(0.7),
        },
        language: faker.helpers.arrayElement(["en", "bn", "hi", "ur"]),
        currency: faker.helpers.arrayElement(["USD", "EUR", "GBP", "BDT"]),
        timezone: faker.helpers.arrayElement([
          "UTC",
          "America/New_York",
          "Europe/London",
          "Asia/Dhaka",
        ]),
        dateFormat: "YYYY-MM-DD",
        timeFormat: faker.helpers.arrayElement(["12", "24"]),
      },
      addresses: [
        {
          type: faker.helpers.arrayElement(["home", "work", "billing"]),
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.country(),
          zipCode: faker.location.zipCode(),
          isDefault: true,
        },
      ],
      loginCount: faker.number.int({ min: 0, max: 50 }),
      lastLoginAt: faker.date.recent(),
      accountCreatedAt: faker.date.past({ years: 2 }),
      metadata: {
        userAgent: faker.internet.userAgent(),
        initialCountry: faker.location.countryCode("alpha-2"),
        signupFlow: faker.helpers.arrayElement(["direct", "social", "invite"]),
      },
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent(),
    });
  }

  return users;
};

// MAIN GENERATION FUNCTION
const generateMockData = async () => {
  try {
    console.log("🚀 Starting user seeding process...");

    // Generate users
    const users = await generateMockUsers();

    console.log(`✅ Generated ${users.length} users`);

    return {
      users,
    };
  } catch (error) {
    console.error("❌ User data generation failed:", error);
    throw error;
  }
};

export default generateMockData;