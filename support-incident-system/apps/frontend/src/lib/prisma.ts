/**
 * lib/prisma.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPRECATED — Frontend no longer accesses the database directly.
 *
 * Architecture:
 *   Frontend → lib/api.ts → Backend API (Express) → Prisma → PostgreSQL
 *
 * This stub prevents runtime crashes from legacy imports.
 * All data access MUST use lib/api.ts instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = new Proxy(
  {},
  {
    get(_target, prop) {
      return new Proxy(
        () => {
          throw new Error(
            `[prisma stub] Direct DB access not allowed in frontend. ` +
            `Use lib/api.ts instead. (accessed: .${String(prop)})`
          );
        },
        {
          get(_fn, innerProp) {
            return () => {
              throw new Error(
                `[prisma stub] Use lib/api.ts for all data access. ` +
                `(accessed: .${String(prop)}.${String(innerProp)})`
              );
            };
          },
        }
      );
    },
  }
);
