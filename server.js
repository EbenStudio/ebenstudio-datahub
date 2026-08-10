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
    1: 6,
    2: 10,
    5: 25.8,
    10: 50
  },

  Telecel: {
    10: 42,
    20: 78,
    50: 180.5
  },

  AirtelTigo: {
    1: 6,
    2: 14,
    5: 24,
    10: 45
  }
};

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Ebenstudio Data Hub is running"
  });
});

app.post("/api/payment/verify", async (req, res) => {
  try {
    const reference = req.body.reference;
    const phoneNumber = req.body.phone_number;
    const network = req.body.network;
    const planSize = Number(req.body.plan_size_gb);

    if (!reference || !phoneNumber || !network || !planSize) {
      return res.status(400).json({
        success: false,
        message: "Missing order information."
      });
    }

    if (!PRICES[network] || !PRICES[network][planSize]) {
      return res.status(400).json({
        success: false,
        message: "Invalid network or data bundle."
      });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Paystack is not configured."
      });
    }

    if (!process.env.RAXAMART_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Rexamart API is not configured."
      });
    }

    const expectedAmount =
      Math.round(PRICES[network][planSize] * 100);

    console.log("Checking Paystack payment:", reference);

    const paymentResponse = await fetch(
      PAYSTACK_API_URL +
        "/transaction/verify/" +
        encodeURIComponent(reference),
      {
        method: "GET",
        headers: {
          Authorization:
            "Bearer " + process.env.PAYSTACK_SECRET_KEY
        }
      }
    );

    const paymentData = await paymentResponse.json();

    if (
      !paymentResponse.ok ||
      !paymentData.status ||
      !paymentData.data
    ) {
      console.log("Paystack verification failed:", paymentData);

      return res.status(400).json({
        success: false,
        message: "Payment could not be verified."
      });
    }

    const payment = paymentData.data;

    if (payment.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful."
      });
    }

    if (payment.currency !== "GHS") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment currency."
      });
    }

    if (Number(payment.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount does not match the selected data bundle."
      });
    }

    console.log("Paystack payment verified.");

    console.log("Sending order to Rexamart...");

    const orderResponse = await fetch(
      ORDER_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key":
            process.env.RAXAMART_API_KEY,
          "X-Idempotency-Key": reference
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          network: network,
          plan_size_gb: planSize,
          reference: reference
        })
      }
    );

    const orderText = await orderResponse.text();

    console.log(
      "Rexamart status:",
      orderResponse.status
    );

    console.log(
      "Rexamart response:",
      orderText
    );

    let orderData;

    try {
      orderData = JSON.parse(orderText);
    } catch {
      orderData = {
        success: false,
        message: orderText
      };
    }

    if (!orderResponse.ok) {
      return res.status(400).json({
        success: false,
        message:
          orderData.message ||
          orderData.error ||
          "Rexamart rejected the order.",
        code: orderData.code || null
      });
    }

    return res.json({
      success: true,
      message: "Payment verified and data order submitted.",
      data: orderData
    });

  } catch (error) {
    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while processing the payment."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    "Ebenstudio Data Hub running on port " + PORT
  );
});
