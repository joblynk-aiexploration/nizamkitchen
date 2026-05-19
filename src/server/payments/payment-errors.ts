export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export class PaymentConfigurationError extends PaymentError {
  constructor(message: string) {
    super(message, "payment_configuration_error");
    this.name = "PaymentConfigurationError";
  }
}

export class PaymentPermissionError extends PaymentError {
  constructor(message = "You do not have permission to manage payments.") {
    super(message, "payment_permission_denied");
    this.name = "PaymentPermissionError";
  }
}

export class PaymentGatewayUnavailableError extends PaymentError {
  constructor(message = "This payment gateway is not available.") {
    super(message, "payment_gateway_unavailable");
    this.name = "PaymentGatewayUnavailableError";
  }
}
