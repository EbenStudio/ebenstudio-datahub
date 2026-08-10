import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;

const ORDER_API_URL =
  "https://adoefozylowntdjktpkk.supabase.co/functions/v1/orders";

const PAYSTACK_API_URL =
  "https://api.paystack.co";

const PRICES = {
  MTN: {
    1: 6.00,
    2: 10.00,
    5: 25.80,
    10: 50.00
  },

  Telecel: {
    10: 42.00,
    20: 78.00,
    50: 180.50
  },

  AirtelTigo: {
    1: 6.00,
    2: 14.00,
    5: 24.00,
    10: 45.00
  }
};


/* HEALTH CHECK */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Ebenstudio Data Hub is running"
  });
});


/* PAYMENT VERIFICATION + REXAMART ORDER */

app.post("/api/payment/verify", async (req, res) => {

  try {

    const {
      reference,
      phone_number,
      network,
      plan_size_gb
    } = req.body;


    /* CHECK CUSTOMER ORDER DATA */

    if (
      !reference ||
      !phone_number ||
      !network ||
      !plan_size_gb
    ) {

      return res.status(400).json({
        success: false,
        message: "Missing order information."
      });

    }


    /* CHECK BUNDLE */

    const planSize =
      Number(plan_size_gb);


    if (
      !PRICES[network] ||
      !PRICES[network][planSize]
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid network or data bundle."
      });

    }


    /* EXPECTED PAYSTACK AMOUNT */

    const expectedAmount =
      Math.round(
        PRICES[network][planSize] * 100
      );


    /* CHECK PAYSTACK SECRET KEY */

    if (
      !process.env.PAYSTACK_SECRET_KEY
    ) {

      console.error(
        "PAYSTACK_SECRET_KEY is missing."
      );

      return res.status(500).json({
        success: false,
        message:
          "Paystack is not configured."
      });

    }


    /* CHECK REXAMART API KEY */

    if (
      !process.env.RAXAMART_API_KEY
    ) {

      console.error(
        "RAXAMART_API_KEY is missing."
      );

      return res.status(500).json({
        success: false,
        message:
          "Rexamart API is not configured."
      });

    }


    /* VERIFY PAYMENT WITH PAYSTACK */

    console.log(
      "Verifying Paystack payment:",
      reference
    );


    const paymentResponse =
      await fetch(
        `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",

          headers: {
            "Authorization":
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );


    const paymentData =
      await paymentResponse.json();


    if (
      !paymentResponse.ok ||
      !paymentData.status ||
      !paymentData.data
    ) {

      console.error(
        "Paystack verification failed:",
        paymentData
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment could not be verified."
      });

    }


    const payment =
      paymentData.data;


    /* CHECK PAYMENT STATUS */

    if (
      payment.status !== "success"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Payment was not successful."
      });

    }


    /* CHECK CURRENCY */

    if (
      payment.currency !== "GHS"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Invalid payment currency."
      });

    }


    /* CHECK AMOUNT */

    if (
      Number(payment.amount) !==
      expectedAmount
    ) {

      console.error(
        "Payment amount mismatch:",
        {
          received:
            payment.amount,

          expected:
            expectedAmount
        }
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment amount does not match the selected data bundle."
      });

    }


    console.log(
      "Paystack payment verified successfully."
    );


    /* CREATE REXAMART ORDER */

    console.log(
      "Creating Rexamart order:",
      {
        phone_number,
        network,
        plan_size_gb: planSize,
        reference
      }
    );


    const orderResponse =
      await fetch(
        ORDER_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-API-Key":
              process.env.RAXAMART_API_KEY,

            "X-Idempotency-Key":
              reference
          },

          body:
            JSON.stringify({
              phone_number,
              network,
              plan_size_gb:
                planSize,
              reference
            })
        }
      );


    /*
      READ REXAMART RESPONSE SAFELY

      Some APIs return JSON while others
      may return plain text.
    */

    const orderText =
      await orderResponse.text();


    let orderData;

    try {

      orderData =
        JSON.parse(orderText);

    } catch {

      orderData = {
        raw_response:
          orderText
      };

    }


    /* LOG THE REAL REXAMART RESPONSE */

    console.log(
      "Rexamart response:",
      {
        status:
          orderResponse.status,

        ok:
          orderResponse.ok,

        data:
          orderData
      }
    );


    /* REXAMART REJECTED THE ORDER */

    if (
      !orderResponse.ok
    ) {

      return res.status(
        orderResponse.status
      ).json({

        success: false,

        message:
          orderData.message ||
          orderData.error ||
          "Rexamart rejected the order.",

        code:
          orderData.code ||
          null

      });

    }


    /* ORDER CREATED */

    console.log(
      "Rexamart order created successfully."
    );


    return res.json(
      orderData
    );


  } catch (error) {

    console.error(
      "Payment verification error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Something went wrong while processing the payment."

    });

  }

});


/* START SERVER */

app.listen(
  PORT,
  () => {

    console.log(
      `Ebenstudio Data Hub running on port ${PORT}`
    );

  }
)￼Enter
