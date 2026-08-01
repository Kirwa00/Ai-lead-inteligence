import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    organizationId?: string;
    /** Epoch ms of the last database re-read of the claims above. */
    claimsRefreshedAt?: number;
  }
}
