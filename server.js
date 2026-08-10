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


// -------------------------
// Health check
// -------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Ebenstudio Data Hub is running"
  });
});


// -------------------------
// Verify Paystack payment
// -------------------------

app.post("/api/payment/verify", async (req, res) => {
  try {
    const {
      reference,
      phone_number,
      network,
      plan_size_gb
    } = req.body;

    if (
      !reference ||
      !phone_number ||
      !network ||
      !plan_size_gb
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment or order information."
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


    // Verify transaction with Paystack

    const paymentResponse = await fetch(
      `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const paymentData = await paymentResponse.json();


    if (
      !paymentResponse.ok ||
      !paymentData.status ||
      !paymentData.data ||
      paymentData.data.status !== "success"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment could not be verified."
      });
    }


    // Make sure the payment currency is Ghana cedis

    if (paymentData.data.currency !== "GHS") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment currency."
      });
    }


    // Payment is verified.
    // Now submit the data order.

    const orderResponse = await fetch(
      ORDER_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.RAXAMART_API_KEY
        },
        body: JSON.stringify({
          phone_number,
          network,
          plan_size_gb,
          reference
        })
      }
    );


    const orderData = await orderResponse.json();


    if (!orderResponse.ok) {
      return res.status(orderResponse.status).json({
        success: false,
        message:
          orderData.message ||
          "Payment succeeded but the data order could not be created."
      });
    }


    return res.json(orderData);

  } catch (error) {

    console.error("Payment verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while processing the payment."
    });
  }
});


// -------------------------
// Start server
// -------------------------

app.listen(PORT, () => {
  console.log(
    `Ebenstudio Data Hub running on port ${PORT}`
  );
});
