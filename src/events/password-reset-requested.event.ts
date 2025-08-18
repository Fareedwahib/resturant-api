export class PasswordResetRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly resetToken: string,
    public readonly userName: string,
  ) {}
}