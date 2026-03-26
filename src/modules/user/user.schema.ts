// Re-export everything from the canonical DB schema so the module layer
// has a single import point.
export {
  users,
  usersRelations,
  roleEnum,
  ROLE_HIERARCHY,
} from "@/db/schema/users";

export type { User, NewUser, Role } from "@/db/schema/users";
