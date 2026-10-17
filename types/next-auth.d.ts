import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan_tier: string;
      plan_ends_at?: string | null;
    } & DefaultSession["user"];
  }
}
