declare module '@paypal/checkout-server-sdk' {
  export namespace core {
    export class PayPalHttpClient {
      constructor(environment: any);
    }
    export class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
  }

  export namespace orders {
    export class OrdersCreateRequest {
      constructor();
      requestBody(body: any): this;
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string);
    }
    export class OrdersGetRequest {
      constructor(orderId: string);
    }
  }

  export namespace payments {
    export class CapturesRefundRequest {
      constructor(captureId: string);
      requestBody(body: any): this;
    }
  }

  export namespace payouts {
    export class PayoutsPostRequest {
      constructor();
      requestBody(body: any): this;
    }
    export class PayoutsGetRequest {
      constructor(payoutBatchId: string);
    }
  }
}
