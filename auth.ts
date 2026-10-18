import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { pool } from "@/lib/db";

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      return String(code);
    }
  }
  return undefined;
}

export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          github_id: profile.id,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!profile?.id) {
        console.error("Sign-in denied", { step: "missing profile id" });
        return false;
      }

      try {
        await pool.query(
          `INSERT INTO users (github_id, email, name, avatar_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (github_id)
           DO UPDATE SET
             email = EXCLUDED.email,
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url;`,
          [
            profile.id,
            user.email || null,
            user.name || null,
            user.image || null,
          ]
        );

        return true;
      } catch (error) {
        console.error("Sign-in denied", {
          step: "upsert user",
          name: error instanceof Error ? error.name : "UnknownError",
          code: errorCode(error),
        });
        return false;
      }
    },

    async session({ session, token }) {
      const githubId = token.github_id ?? token.sub;
      if (githubId) {
        try {
          const res = await pool.query(
            "SELECT id, plan_tier, plan_ends_at FROM users WHERE github_id = $1",
            [githubId]
          );

          if (res.rows.length > 0) {
            const dbUser = res.rows[0];
            session.user.id = dbUser.id;
            session.user.plan_tier = dbUser.plan_tier;
            session.user.plan_ends_at = dbUser.plan_ends_at;
          }
        } catch (error) {
          console.error("Error fetching user session data from Neon:", error);
        }
      }
      return session;
    },

    async jwt({ token, profile, user }) {
      if (profile?.id) {
        token.github_id = profile.id;
      } else if (!token.github_id && user?.id) {
        token.github_id = user.id;
      }
      return token;
    },
  },
}));
