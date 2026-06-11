/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@cashfreepayments/cashfree-js" {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top" | "_parent";
    returnUrl?: string;
  }

  interface CashfreeCheckoutResult {
    error?: {
      message: string;
      code?: string;
      type?: string;
    };
    redirect?: boolean;
    paymentDetails?: any;
  }

  interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
    version(): string;
  }

  interface LoadOptions {
    mode: "sandbox" | "production";
  }

  export function load(options: LoadOptions): Promise<CashfreeInstance>;
}
