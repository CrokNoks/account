export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<{ id: string, email: string } | null>;
}
