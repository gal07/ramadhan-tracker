import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validasi dengan data hardcoded
        if (
          credentials?.email === "galihkur@gmail.com" &&
          credentials?.password === "admin1234"
        ) {
          return {
            id: "1",
            name: "Galih Kur",
            email: "galihkur@gmail.com",
          };
        }
        // Return null jika kredensial tidak valid
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/", // Redirect ke halaman login kita
  },
  callbacks: {
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
