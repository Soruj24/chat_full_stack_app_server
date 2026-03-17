import mongoose, { Schema, Document } from "mongoose";

export interface ISupportTicket extends Document {
  ticketNumber: string;
  userId: mongoose.Types.ObjectId;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  attachments: string[];
  comments: {
    userId: mongoose.Types.ObjectId;
    message: string;
    attachments: string[];
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema: Schema<ISupportTicket> = new Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    attachments: [
      {
        type: String,
      },
    ],
    comments: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        attachments: [String],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Pre-save hook to generate ticket number if not provided
SupportTicketSchema.pre("validate", async function (this: ISupportTicket) {
  if (!this.ticketNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const count = await mongoose.model("SupportTicket").countDocuments();
    this.ticketNumber = `TKT-${year}${month}-${(count + 1).toString().padStart(4, "0")}`;
  }
});

export const SupportTicket = mongoose.model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema
);
