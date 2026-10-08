import NextAuth from "next-auth";
import { opcoesAuth } from "@/lib/servidor/auth";

const tratar = NextAuth(opcoesAuth);

export { tratar as GET, tratar as POST };
