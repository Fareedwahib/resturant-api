export class DeliveryStaffRegisteredEvent {
  constructor(
    public readonly adminEmail: string,
    public readonly deliveryStaff: {
      email: string;
      firstName: string;
      lastName: string;
      phone: string;
      vehicleType: string;
      licenseNumber: string;
      selfieUrl: string;
      nationalIdFrontUrl: string;
      nationalIdBackUrl: string;
    },
  ) {}
}