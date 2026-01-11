import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt", // Penting: gunakan JWT strategy
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 24 * 60 * 60, // Re-validate once a day
  },
  pages: {
    signIn: "/", // Redirect ke halaman login kita
    signOut: "/", // Redirect ke halaman home setelah logout
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Jika URL adalah baseUrl (root), redirect ke dashboard
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/dashboard`;
      }
      // Jika callback URL adalah dashboard, gunakan itu
      if (url === `${baseUrl}/dashboard`) {
        return url;
      }
      // Untuk relative URLs
      if (url.startsWith('/')) {
        // Jika relative URL adalah root, redirect ke dashboard
        if (url === '/') {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      }
      // Untuk absolute URLs dengan same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Default ke dashboard
      return `${baseUrl}/dashboard`;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-ignore - NextAuth types don't include custom fields
        session.user.id = token.sub as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
