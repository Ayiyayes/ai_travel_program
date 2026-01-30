import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const devAdminBypass = process.env.DEV_ADMIN_BYPASS === "true";
    if (process.env.NODE_ENV === "development" && devAdminBypass) {
      const devAdminUser = ctx.user ?? {
        id: 0,
        openId: "local-super-admin",
        name: "Dev Admin",
        email: null,
        avatar: null,
        loginMethod: "dev",
        role: "admin",
        points: 0,
        initialFreeCredits: 0,
        hasUsedFreeCredits: false,
        channelId: null,
        salesId: null,
        promotionCodeId: null,
        gender: null,
        userType: null,
        faceType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        lastSelfieUrl: null,
        lastSelfieTime: null,
      };

      return next({
        ctx: {
          ...ctx,
          user: { ...devAdminUser, role: "admin" },
        },
      });
    }

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
