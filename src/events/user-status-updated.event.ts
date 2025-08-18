export class UserStatusUpdatedEvent {
  constructor(
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
  ) {}
}